const GITHUB_API_BASE_URL = "https://api.github.com";
const SECONDARY_LIMIT_COOLDOWN_MS = 2 * 60 * 1000;
let secondaryRateLimitBlockedUntil = 0;

export type GitHubDebugEntry = {
  timestamp: string;
  method: "GET";
  url: string;
  requestHeaders: Record<string, string>;
  status: number;
  responseHeaders: Record<string, string>;
  responseSummary?: string;
  responseBodyPreview?: string;
};

export type GitHubDebugCollector = {
  enabled: boolean;
  entries: GitHubDebugEntry[];
};

export class GitHubApiError extends Error {
  status: number;
  isSecondaryRateLimit: boolean;
  retryAfterMs: number | null;

  constructor(
    message: string,
    status: number,
    options?: { isSecondaryRateLimit?: boolean; retryAfterMs?: number | null }
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.isSecondaryRateLimit = options?.isSecondaryRateLimit ?? false;
    this.retryAfterMs = options?.retryAfterMs ?? null;
  }
}

export function hasGitHubToken() {
  return Boolean(process.env.GITHUB_TOKEN);
}

function getGitHubHeaders() {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-contribution-matchmaker",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function sanitizeHeaders(headers: HeadersInit) {
  const result: Record<string, string> = {};
  const entries = headers instanceof Headers
    ? Array.from(headers.entries())
    : Array.isArray(headers)
      ? headers
      : Object.entries(headers);
  for (const [key, rawValue] of entries) {
    const value = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue);
    if (key.toLowerCase() === "authorization") {
      result[key] = "Bearer [REDACTED]";
      continue;
    }
    result[key] = value;
  }
  return result;
}

function headersToObject(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

function addDebugEntry(collector: GitHubDebugCollector | undefined, entry: GitHubDebugEntry) {
  if (!collector?.enabled) return;
  collector.entries.push(entry);
}

function parseRetryAfterMs(retryAfter: string | null) {
  const parsed = Number(retryAfter);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed * 1000;
}

export async function githubRequest<T>(
  path: string,
  searchParams?: URLSearchParams,
  debugCollector?: GitHubDebugCollector
) {
  if (secondaryRateLimitBlockedUntil > Date.now()) {
    const retryAfterMs = secondaryRateLimitBlockedUntil - Date.now();
    throw new GitHubApiError(
      "GitHub secondary rate limit active. Using cooldown window before next outbound request.",
      429,
      { isSecondaryRateLimit: true, retryAfterMs }
    );
  }

  const query = searchParams?.toString();
  const url = `${GITHUB_API_BASE_URL}${path}${query ? `?${query}` : ""}`;

  const requestHeaders = getGitHubHeaders();
  const response = await fetch(url, {
    headers: requestHeaders,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

    if (response.status === 403 && remaining === "0") {
      throw new GitHubApiError(
        `GitHub rate limit reached. Reset at unix timestamp ${reset ?? "unknown"}.`,
        response.status
      );
    }

    const body = await response.text();
    addDebugEntry(debugCollector, {
      timestamp: new Date().toISOString(),
      method: "GET",
      url,
      requestHeaders: sanitizeHeaders(requestHeaders),
      status: response.status,
      responseHeaders: headersToObject(response.headers),
      responseBodyPreview: body.slice(0, 800),
    });
    const isSecondaryRateLimit =
      response.status === 403 && body.toLowerCase().includes("secondary rate limit");

    if (isSecondaryRateLimit) {
      secondaryRateLimitBlockedUntil =
        Date.now() + (retryAfterMs ?? SECONDARY_LIMIT_COOLDOWN_MS);
    }

    throw new GitHubApiError(`GitHub API request failed: ${response.status} ${body}`, response.status, {
      isSecondaryRateLimit,
      retryAfterMs,
    });
  }

  const json = (await response.json()) as T;
  const summaryParts: string[] = [];
  const maybeRecord = json as Record<string, unknown>;
  if (typeof maybeRecord?.total_count === "number") {
    summaryParts.push(`total_count=${String(maybeRecord.total_count)}`);
  }
  if (Array.isArray(maybeRecord?.items)) {
    summaryParts.push(`items=${String(maybeRecord.items.length)}`);
  }
  if (typeof maybeRecord?.message === "string") {
    summaryParts.push(`message=${String(maybeRecord.message)}`);
  }
  addDebugEntry(debugCollector, {
    timestamp: new Date().toISOString(),
    method: "GET",
    url,
    requestHeaders: sanitizeHeaders(requestHeaders),
    status: response.status,
    responseHeaders: headersToObject(response.headers),
    responseSummary: summaryParts.join(", ") || "ok",
  });

  return json;
}
