import { NextResponse } from "next/server";
import {
  AUTHENTICATED_QUERY_VARIANTS,
  SEARCH_CACHE,
  SEARCH_ENRICHMENT,
  SEARCH_PAGINATION,
  UNAUTHENTICATED_QUERY_VARIANTS,
} from "@/lib/config/search";
import { ensureDemoUser, getUserPreferences } from "@/lib/db/queries/preference";
import { GitHubApiError, GitHubDebugCollector, hasGitHubToken } from "@/lib/github/client";
import { IssueCandidate, isRecentlyUpdated, mapGitHubIssueToCandidate } from "@/lib/github/mappers";
import { RepositoryDetails, buildIssueSearchQuery, fetchRepositoryDetails, searchGitHubIssues } from "@/lib/github/queries";
import { normalizePreferenceInput, scoreIssues } from "@/lib/scoring/calculateIssueScore";

type SearchResponsePayload = {
  query: string;
  totalCount: number;
  count: number;
  items: EnrichedScoredIssue[];
};

type CachedResponse = {
  expiresAt: number;
  staleUntil: number;
  payload: SearchResponsePayload;
};

type EnrichedIssueCandidate = IssueCandidate & {
  repoName: string;
  repoDisplayFullName: string;
  repoDescription: string | null;
  repoHomepageUrl: string;
  repoTechStack: string[];
};

type EnrichedScoredIssue = EnrichedIssueCandidate & {
  score: ReturnType<typeof scoreIssues<EnrichedIssueCandidate>>[number]["score"];
};

type CachedRepoDetails = {
  expiresAt: number;
  details: RepositoryDetails;
};

const responseCache = new Map<string, CachedResponse>();
const inFlightRequests = new Map<string, Promise<SearchResponsePayload>>();
const repoDetailsCache = new Map<string, CachedRepoDetails>();
const inFlightRepoDetailsRequests = new Map<string, Promise<RepositoryDetails>>();

function parsePerPage(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return SEARCH_PAGINATION.DEFAULT_PER_PAGE;
  }

  return Math.min(Math.floor(parsed), SEARCH_PAGINATION.MAX_PER_PAGE);
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.floor(parsed);
}

function dedupeIssues<T extends { githubIssueId: number }>(items: T[]) {
  const seenIssueIds = new Set<number>();
  const result: T[] = [];

  for (const item of items) {
    if (seenIssueIds.has(item.githubIssueId)) {
      continue;
    }

    seenIssueIds.add(item.githubIssueId);
    result.push(item);
  }

  return result;
}

function mergeUniqueIssues<T extends { githubIssueId: number }>(current: T[], incoming: T[]) {
  if (current.length === 0) return dedupeIssues(incoming);
  if (incoming.length === 0) return current;

  const byId = new Map<number, T>();
  for (const item of current) {
    byId.set(item.githubIssueId, item);
  }
  for (const item of incoming) {
    if (!byId.has(item.githubIssueId)) {
      byId.set(item.githubIssueId, item);
    }
  }

  return Array.from(byId.values());
}

function buildCacheKey(input: {
  perPage: number;
  page: number;
  skillLevel: string;
  preferredLanguages: string[];
  preferredAreas: string[];
  preferredIssueSize: string;
  activeReposOnly: boolean;
}) {
  return JSON.stringify({
    perPage: input.perPage,
    page: input.page,
    skillLevel: input.skillLevel,
    preferredLanguages: [...input.preferredLanguages].sort(),
    preferredAreas: [...input.preferredAreas].sort(),
    preferredIssueSize: input.preferredIssueSize,
    activeReposOnly: input.activeReposOnly,
  });
}

function getCachedResponse(cacheKey: string, options?: { allowStale?: boolean }) {
  const allowStale = options?.allowStale ?? false;
  const hit = responseCache.get(cacheKey);
  if (!hit) return null;

  const now = Date.now();
  if (hit.expiresAt > now) {
    return {
      payload: hit.payload,
      stale: false,
    };
  }

  if (allowStale && hit.staleUntil > now) {
    return {
      payload: hit.payload,
      stale: true,
    };
  }

  if (hit.staleUntil <= now) {
    responseCache.delete(cacheKey);
  }

  return null;
}

function getCachedRepoDetails(repoFullName: string) {
  const hit = repoDetailsCache.get(repoFullName);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    repoDetailsCache.delete(repoFullName);
    return null;
  }

  return hit.details;
}

function normalizeStackTag(tag: string) {
  return tag.trim().toLowerCase();
}

function fallbackTechStackFromIssue(issue: IssueCandidate) {
  const ignoredLabels = new Set([
    "good first issue",
    "help wanted",
    "bug",
    "enhancement",
    "documentation",
    "docs",
    "first-timers-only",
    "hacktoberfest",
    "up-for-grabs",
    "community",
    "bounty",
  ]);

  const labelDerived = issue.labels
    .map(normalizeStackTag)
    .filter((label) => !ignoredLabels.has(label))
    .filter((label) => label.length <= 24)
    .filter((label) => !label.includes(" "))
    .slice(0, 6);

  const fallback = [issue.repoPrimaryLanguage?.toLowerCase() ?? "", ...labelDerived].filter(Boolean);
  return Array.from(new Set(fallback));
}

function fallbackRepoDetailsFromIssue(issue: IssueCandidate): RepositoryDetails {
  const [, repoName = issue.repoFullName] = issue.repoFullName.split("/");
  const resolvedName = repoName || issue.repoFullName;

  return {
    name: resolvedName,
    fullName: issue.repoFullName,
    htmlUrl: issue.repoUrl,
    description: null,
    primaryLanguage: issue.repoPrimaryLanguage ?? null,
    techStack: fallbackTechStackFromIssue(issue),
  };
}

async function getRepoDetails(repoFullName: string, debugCollector?: GitHubDebugCollector) {
  const cached = getCachedRepoDetails(repoFullName);
  if (cached) return cached;

  const inFlight = inFlightRepoDetailsRequests.get(repoFullName);
  if (inFlight) return inFlight;

  const request = (async () => {
    const details = await fetchRepositoryDetails(repoFullName, debugCollector);
    const normalizedDetails: RepositoryDetails = {
      ...details,
      techStack: Array.from(new Set(details.techStack.map(normalizeStackTag).filter(Boolean))),
    };

    repoDetailsCache.set(repoFullName, {
      expiresAt: Date.now() + SEARCH_CACHE.REPO_TECH_TTL_MS,
      details: normalizedDetails,
    });
    return normalizedDetails;
  })();

  inFlightRepoDetailsRequests.set(repoFullName, request);
  try {
    return await request;
  } finally {
    inFlightRepoDetailsRequests.delete(repoFullName);
  }
}

async function enrichIssuesWithRepoTechStack(
  items: IssueCandidate[],
  maxRepoLookups: number,
  debugCollector?: GitHubDebugCollector
): Promise<EnrichedIssueCandidate[]> {
  const uniqueRepos = Array.from(new Set(items.map((item) => item.repoFullName)));
  const limitedRepos = uniqueRepos.slice(0, Math.max(0, maxRepoLookups));
  const repoDetailsByName = new Map<string, RepositoryDetails>();
  const queue = [...limitedRepos];

  async function worker() {
    while (queue.length > 0) {
      const repo = queue.shift();
      if (!repo) break;
      try {
        const details = await getRepoDetails(repo, debugCollector);
        repoDetailsByName.set(repo, details);
      } catch {
        // Ignore lookup failures and fall back to issue-derived tags.
      }
    }
  }

  const workerCount = Math.min(SEARCH_ENRICHMENT.REPO_TECH_LOOKUP_CONCURRENCY, queue.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return items.map((item) => {
    const details = repoDetailsByName.get(item.repoFullName) ?? fallbackRepoDetailsFromIssue(item);

    return {
      ...item,
      repoPrimaryLanguage: item.repoPrimaryLanguage ?? details.primaryLanguage,
      repoName: details.name,
      repoDisplayFullName: details.fullName,
      repoDescription: details.description,
      repoHomepageUrl: details.htmlUrl,
      repoTechStack: details.techStack,
    };
  });
}

export async function GET(request: Request) {
  try {
    const user = await ensureDemoUser();
    const preferences = await getUserPreferences(user.id);

    if (!preferences) {
      return NextResponse.json(
        { error: "User preferences not found. Complete onboarding first." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const debugEnabled = ["1", "true", "yes", "on"].includes((searchParams.get("debug") ?? "").toLowerCase());
    const debugCollector: GitHubDebugCollector = {
      enabled: debugEnabled,
      entries: [],
    };
    const perPage = parsePerPage(searchParams.get("perPage"));
    const page = parsePage(searchParams.get("page"));
    const normalizedPreferences = normalizePreferenceInput(preferences);
    const hasToken = hasGitHubToken();
    const cacheKey = buildCacheKey({
      perPage,
      page,
      skillLevel: normalizedPreferences.skillLevel,
      preferredLanguages: normalizedPreferences.preferredLanguages,
      preferredAreas: normalizedPreferences.preferredAreas,
      preferredIssueSize: normalizedPreferences.preferredIssueSize,
      activeReposOnly: normalizedPreferences.activeReposOnly,
    });

    const queryVariants = hasToken
      ? AUTHENTICATED_QUERY_VARIANTS
      : UNAUTHENTICATED_QUERY_VARIANTS;
    const maxRepoLookups = hasToken
      ? SEARCH_ENRICHMENT.MAX_REPO_TECH_LOOKUPS_WITH_TOKEN
      : SEARCH_ENRICHMENT.MAX_REPO_TECH_LOOKUPS_NO_TOKEN;
    const skipCache = debugEnabled;

    if (!skipCache) {
      const cachedPayload = getCachedResponse(cacheKey);
      if (cachedPayload) {
        return NextResponse.json({
          ...cachedPayload.payload,
          servedFromCache: true,
          isStaleCache: cachedPayload.stale,
          ...(debugEnabled
            ? {
                debug: {
                  source: "cache",
                  githubApi: debugCollector.entries,
                },
              }
            : {}),
        });
      }
    }

    const stalePayload = skipCache ? null : getCachedResponse(cacheKey, { allowStale: true });

    if (!skipCache) {
      const inFlight = inFlightRequests.get(cacheKey);
      if (inFlight) {
        const payload = await inFlight;
        return NextResponse.json({
          ...payload,
          servedFromCache: true,
          isStaleCache: false,
          ...(debugEnabled
            ? {
                debug: {
                  source: "in_flight_shared",
                  githubApi: debugCollector.entries,
                },
              }
            : {}),
        });
      }
    }

    const requestPromise = (async (): Promise<SearchResponsePayload> => {
      let selectedQuery = "";
      let selectedTotalCount = 0;
      let items = [] as ReturnType<typeof mapGitHubIssueToCandidate>[];
      const maxPerQueryPage = hasToken
        ? SEARCH_PAGINATION.MAX_PER_QUERY_PAGE_WITH_TOKEN
        : SEARCH_PAGINATION.MAX_PER_QUERY_PAGE_NO_TOKEN;
      const perQueryPage = Math.min(
        Math.max(Math.ceil(perPage / 2), SEARCH_PAGINATION.MIN_PER_QUERY_PAGE),
        maxPerQueryPage
      );
      const targetPoolSize = Math.max(perPage * SEARCH_PAGINATION.TARGET_POOL_MULTIPLIER, perQueryPage);

      for (const variant of queryVariants) {
        const query = buildIssueSearchQuery(normalizedPreferences, variant);
        const searchResponse = await searchGitHubIssues(query, perQueryPage, page, debugCollector);
        const mappedItems = searchResponse.items.map(mapGitHubIssueToCandidate);

        if (!selectedQuery) {
          selectedQuery = query;
        }
        selectedTotalCount = Math.max(selectedTotalCount, searchResponse.total_count);
        items = mergeUniqueIssues(items, mappedItems);

        if (items.length >= targetPoolSize) {
          break;
        }
      }

      if (preferences.activeReposOnly) {
        // Search API does not include full repo activity metadata by default.
        // Use issue recency as a pragmatic proxy for active repositories in MVP.
        items = items.filter((item) => isRecentlyUpdated(item.updatedAt, 90));
      }

      const dedupedItems = dedupeIssues(items);
      const enrichedItems = await enrichIssuesWithRepoTechStack(dedupedItems, maxRepoLookups, debugCollector);
      const scoredItems = scoreIssues(enrichedItems, normalizedPreferences).slice(0, perPage);

      return {
        query: selectedQuery,
        totalCount: selectedTotalCount,
        count: scoredItems.length,
        items: scoredItems,
      };
    })();

    if (!skipCache) {
      inFlightRequests.set(cacheKey, requestPromise);
    }
    let payload: SearchResponsePayload;
    try {
      payload = await requestPromise;
      if (!skipCache) {
        responseCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE.RESPONSE_TTL_MS,
          staleUntil: Date.now() + SEARCH_CACHE.RESPONSE_STALE_TTL_MS,
          payload,
        });
      }
    } catch (error) {
      if (error instanceof GitHubApiError && error.isSecondaryRateLimit && stalePayload) {
        return NextResponse.json(
          {
            ...stalePayload.payload,
            servedFromCache: true,
            isStaleCache: true,
            warning: "Showing cached results while GitHub rate limit cools down.",
            ...(debugEnabled
              ? {
                  debug: {
                    source: "stale_cache_fallback",
                    githubApi: debugCollector.entries,
                  },
                }
              : {}),
          },
          { status: 200 }
        );
      }
      throw error;
    } finally {
      if (!skipCache) {
        inFlightRequests.delete(cacheKey);
      }
    }

    return NextResponse.json({
      ...payload,
      servedFromCache: false,
      isStaleCache: false,
      ...(debugEnabled
        ? {
            debug: {
              source: "live",
              githubApi: debugCollector.entries,
            },
          }
        : {}),
    });
  } catch (error) {
    const debugEnabled = ["1", "true", "yes", "on"].includes(
      (new URL(request.url).searchParams.get("debug") ?? "").toLowerCase()
    );
    if (error instanceof GitHubApiError) {
      if (error.isSecondaryRateLimit || error.message.toLowerCase().includes("secondary rate limit")) {
        return NextResponse.json(
          {
            error: "GitHub secondary rate limit hit. Wait a few minutes and try again.",
            retryAfterMs: error.retryAfterMs ?? undefined,
            ...(debugEnabled ? { debugHint: "append ?debug=1 to see sanitized GitHub request traces." } : {}),
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: error.message,
          ...(debugEnabled ? { debugHint: "append ?debug=1 to see sanitized GitHub request traces." } : {}),
        },
        { status: error.status }
      );
    }

    console.error("Failed to search GitHub issues:", error);
    return NextResponse.json({ error: "Failed to search GitHub issues" }, { status: 500 });
  }
}
