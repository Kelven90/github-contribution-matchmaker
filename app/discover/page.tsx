"use client";

import { useEffect, useMemo, useState } from "react";
import { DISCOVER_UI } from "@/lib/config/ui";
import { inferIssueAreasFromText, textContainsKeyword } from "@/lib/scoring/areaClassifier";
import type { ScoredIssueCandidate } from "@/lib/scoring/calculateIssueScore";
import type { ContributionArea } from "@/types/preferences";
import SimpleModal from "@/components/ui/SimpleModal";

type DiscoverIssue = ScoredIssueCandidate & {
  repoName?: string;
  repoDisplayFullName?: string;
  repoDescription?: string | null;
  repoHomepageUrl?: string;
  repoTechStack?: string[];
};

type SearchIssuesResponse = {
  query: string;
  totalCount: number;
  count: number;
  items: DiscoverIssue[];
  error?: string;
  debug?: {
    source: string;
    githubApi: Array<{
      timestamp: string;
      method: string;
      url: string;
      status: number;
      requestHeaders: Record<string, string>;
      responseHeaders: Record<string, string>;
      responseSummary?: string;
      responseBodyPreview?: string;
    }>;
  };
};

type PreferenceResponse = {
  preferredLanguages: string[];
  preferredAreas: string[];
};

type ContentLanguageOption =
  | "all"
  | "english"
  | "other";

type FilterOption = {
  value: string;
  count: number;
};

type ViewMode = "panel" | "list";

const UNKNOWN_LANGUAGE_VALUE = "__unknown_language__";
const UNKNOWN_LANGUAGE_LABEL = "Unknown";
const PAGE_SIZE_OPTIONS = DISCOVER_UI.PAGE_SIZE_OPTIONS;
const MAX_BROWSABLE_PAGES = DISCOVER_UI.MAX_BROWSABLE_PAGES;

type RepoColorTheme = {
  panel: string;
  header: string;
  issueCard: string;
  details: string;
  connector: string;
  mutedText: string;
  accentText: string;
  softBadge: string;
};

const REPO_COLOR_THEMES: RepoColorTheme[] = [
  {
    panel: "border-sky-300 bg-sky-50/40",
    header: "border-sky-200 bg-sky-50/70",
    issueCard: "border-sky-200 bg-white/90",
    details: "border-sky-200 bg-white/90",
    connector: "border-sky-300/70",
    mutedText: "text-sky-700",
    accentText: "text-sky-900",
    softBadge: "border-sky-300 bg-sky-100 text-sky-800",
  },
  {
    panel: "border-violet-300 bg-violet-50/40",
    header: "border-violet-200 bg-violet-50/70",
    issueCard: "border-violet-200 bg-white/90",
    details: "border-violet-200 bg-white/90",
    connector: "border-violet-300/70",
    mutedText: "text-violet-700",
    accentText: "text-violet-900",
    softBadge: "border-violet-300 bg-violet-100 text-violet-800",
  },
  {
    panel: "border-emerald-300 bg-emerald-50/40",
    header: "border-emerald-200 bg-emerald-50/70",
    issueCard: "border-emerald-200 bg-white/90",
    details: "border-emerald-200 bg-white/90",
    connector: "border-emerald-300/70",
    mutedText: "text-emerald-700",
    accentText: "text-emerald-900",
    softBadge: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  {
    panel: "border-amber-300 bg-amber-50/40",
    header: "border-amber-200 bg-amber-50/70",
    issueCard: "border-amber-200 bg-white/90",
    details: "border-amber-200 bg-white/90",
    connector: "border-amber-300/70",
    mutedText: "text-amber-700",
    accentText: "text-amber-900",
    softBadge: "border-amber-300 bg-amber-100 text-amber-800",
  },
  {
    panel: "border-rose-300 bg-rose-50/40",
    header: "border-rose-200 bg-rose-50/70",
    issueCard: "border-rose-200 bg-white/90",
    details: "border-rose-200 bg-white/90",
    connector: "border-rose-300/70",
    mutedText: "text-rose-700",
    accentText: "text-rose-900",
    softBadge: "border-rose-300 bg-rose-100 text-rose-800",
  },
];

function getRepoColorTheme(repoFullName: string): RepoColorTheme {
  let hash = 0;
  for (let i = 0; i < repoFullName.length; i += 1) {
    hash = (hash << 5) - hash + repoFullName.charCodeAt(i);
    hash |= 0;
  }
  return REPO_COLOR_THEMES[Math.abs(hash) % REPO_COLOR_THEMES.length];
}

function getScoreTone(score: number): { pill: string } {
  if (score >= 75) {
    return { pill: "border border-green-300 bg-green-50 text-green-700" };
  }
  if (score >= 50) {
    return { pill: "border border-amber-300 bg-amber-50 text-amber-700" };
  }
  return { pill: "border border-red-300 bg-red-50 text-red-700" };
}

type IssueFilterCriteria = {
  minScore?: number;
  selectedLanguage?: string;
  selectedContentLanguage?: ContentLanguageOption;
  selectedArea?: string;
  selectedLabel?: string;
  hidePenalized?: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function detectContentLanguage(text: string): Exclude<ContentLanguageOption, "all"> {
  const value = text.toLowerCase();
  const lettersOnly = value.replace(/[^a-z]/g, "");
  const nonSpaceChars = value.replace(/\s/g, "");
  const asciiLetterRatio = lettersOnly.length / Math.max(1, nonSpaceChars.length);

  // Strong non-Latin script signals => Others.
  if (/[\u3040-\u30ff\u4e00-\u9fff\u0400-\u04ff\u0600-\u06ff]/.test(text)) {
    return "other";
  }

  // Strong Latin accented signals (Spanish/Portuguese/etc.) => Others.
  if (/[ñáéíóú¿¡ãõçâêôàèìòùäëïöü]/i.test(text)) {
    return "other";
  }

  const englishWords = [
    " the ",
    " and ",
    " with ",
    " for ",
    " issue ",
    " bug ",
    " fix ",
    " add ",
    " update ",
    " refactor ",
    " setup ",
    " improve ",
    " error ",
  ];
  const englishWordHits = englishWords.filter((word) => value.includes(word)).length;
  const hasEnglishLikeSentence = /\b(the|and|with|for|issue|bug|fix|add|update|refactor|improve)\b/i.test(value);
  if (englishWordHits >= 1 || hasEnglishLikeSentence) {
    return "english";
  }

  // Fallback for technical repos/issues that are mostly ASCII/Latin text.
  if (asciiLetterRatio > 0.45) {
    return "english";
  }

  return "other";
}

type RepoIssueGroup = {
  repoFullName: string;
  issues: DiscoverIssue[];
};

function groupIssuesByRepo(issues: DiscoverIssue[]): RepoIssueGroup[] {
  const groups = new Map<string, RepoIssueGroup>();

  for (const issue of issues) {
    const existing = groups.get(issue.repoFullName);
    if (existing) {
      existing.issues.push(issue);
      continue;
    }

    groups.set(issue.repoFullName, {
      repoFullName: issue.repoFullName,
      issues: [issue],
    });
  }

  return Array.from(groups.values());
}

const AREA_LABEL_HINTS: Record<string, string[]> = {
  frontend: ["frontend", "ui", "ux"],
  backend: ["backend", "api", "server"],
  docs: ["docs", "documentation"],
  testing: ["test", "testing", "qa"],
};

function getIssueDerivedAreas(issue: DiscoverIssue): string[] {
  const inferredAreas = inferIssueAreasFromText({
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });

  const labelAreas = new Set<string>();
  for (const label of issue.labels) {
    const lowered = label.toLowerCase();
    for (const [area, hints] of Object.entries(AREA_LABEL_HINTS)) {
      if (hints.some((hint) => textContainsKeyword(lowered, hint))) {
        labelAreas.add(area);
      }
    }
  }

  return Array.from(new Set<string>([...inferredAreas, ...labelAreas]));
}

type IssueViewMeta = {
  issue: DiscoverIssue;
  contentLanguage: Exclude<ContentLanguageOption, "all">;
  derivedAreas: string[];
  languageKey: string;
  lowerLabels: string[];
};

function issueMatchesCriteria(meta: IssueViewMeta, criteria: IssueFilterCriteria) {
  if (typeof criteria.minScore === "number" && meta.issue.score.finalScore < criteria.minScore) return false;

  if (criteria.selectedLanguage && criteria.selectedLanguage !== "all") {
    if (criteria.selectedLanguage === UNKNOWN_LANGUAGE_VALUE) {
      if (meta.issue.repoPrimaryLanguage) return false;
    } else if (meta.issue.repoPrimaryLanguage !== criteria.selectedLanguage) {
      return false;
    }
  }

  if (criteria.selectedContentLanguage && criteria.selectedContentLanguage !== "all") {
    if (meta.contentLanguage !== criteria.selectedContentLanguage) return false;
  }

  if (criteria.selectedArea && criteria.selectedArea !== "all") {
    if (!meta.derivedAreas.includes(criteria.selectedArea)) return false;
  }

  if (criteria.selectedLabel && criteria.selectedLabel !== "all") {
    const selected = criteria.selectedLabel.toLowerCase();
    if (!meta.lowerLabels.some((label) => label === selected)) return false;
  }

  if (criteria.hidePenalized && meta.issue.score.penaltyScore > 0) return false;

  return true;
}

function getLabelMatches(issue: DiscoverIssue, preferences: PreferenceResponse | null) {
  if (!preferences) {
    return {
      matchedLabels: [] as string[],
      otherLabels: issue.labels,
      hasRepoLanguageMatch: false,
      inferredAreaMatches: [] as string[],
    };
  }

  const preferredLanguageTerms = preferences.preferredLanguages.map((item) => item.toLowerCase());
  const preferredAreaTerms = preferences.preferredAreas.flatMap((area) => AREA_LABEL_HINTS[area] ?? [area]);
  const terms = [...preferredLanguageTerms, ...preferredAreaTerms];

  const matchedLabels: string[] = [];
  const otherLabels: string[] = [];

  for (const label of issue.labels) {
    const lowered = label.toLowerCase();
    const isMatch = terms.some((term) => textContainsKeyword(lowered, term));
    if (isMatch) matchedLabels.push(label);
    else otherLabels.push(label);
  }

  const hasRepoLanguageMatch = Boolean(
    issue.repoPrimaryLanguage &&
      preferredLanguageTerms.includes(issue.repoPrimaryLanguage.toLowerCase())
  );

  const inferredAreas = inferIssueAreasFromText({
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });
  const inferredAreaMatches = preferences.preferredAreas.filter((area) =>
    inferredAreas.includes(area as ContributionArea) ||
    textContainsKeyword(`${issue.title} ${issue.body ?? ""} ${issue.labels.join(" ")}`, area)
  );

  return {
    matchedLabels,
    otherLabels,
    hasRepoLanguageMatch,
    inferredAreaMatches,
  };
}

export default function DiscoverPage() {
  const [issues, setIssues] = useState<DiscoverIssue[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [preferences, setPreferences] = useState<PreferenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<DiscoverIssue | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedContentLanguage, setSelectedContentLanguage] = useState<ContentLanguageOption>("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedLabel, setSelectedLabel] = useState("all");
  const [hidePenalized, setHidePenalized] = useState(false);
  const [isPenaltyInfoOpen, setIsPenaltyInfoOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("panel");
  const [pageSize, setPageSize] = useState<number>(DISCOVER_UI.DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const serverPerPage = DISCOVER_UI.SERVER_PER_PAGE;

  const issueMetas = useMemo<IssueViewMeta[]>(
    () =>
      issues.map((issue) => ({
        issue,
        contentLanguage: detectContentLanguage(`${issue.repoDescription ?? ""} ${issue.title} ${issue.body ?? ""}`),
        derivedAreas: getIssueDerivedAreas(issue),
        languageKey: issue.repoPrimaryLanguage?.trim() || UNKNOWN_LANGUAGE_VALUE,
        lowerLabels: issue.labels.map((label) => label.toLowerCase()),
      })),
    [issues]
  );

  const minScoreSliderMax = useMemo(() => {
    const highestScore = issueMetas.reduce((max, meta) => Math.max(max, meta.issue.score.finalScore), 0);
    return Math.max(100, Math.ceil(highestScore / 10) * 10);
  }, [issueMetas]);

  useEffect(() => {
    if (minScore > minScoreSliderMax) {
      setMinScore(minScoreSliderMax);
    }
  }, [minScore, minScoreSliderMax]);

  const filteredMetas = useMemo(
    () =>
      issueMetas.filter((meta) =>
        issueMatchesCriteria(meta, {
          minScore,
          selectedLanguage,
          selectedContentLanguage,
          selectedArea,
          selectedLabel,
          hidePenalized,
        })
      ),
    [hidePenalized, issueMetas, minScore, selectedArea, selectedContentLanguage, selectedLabel, selectedLanguage]
  );
  const filteredIssues = useMemo(() => filteredMetas.map((meta) => meta.issue), [filteredMetas]);

  const languageFacet = useMemo(() => {
    const counts = new Map<string, number>();
    let allCount = 0;
    for (const meta of issueMetas) {
      if (
        !issueMatchesCriteria(meta, {
          minScore,
          selectedContentLanguage,
          selectedArea,
          selectedLabel,
          hidePenalized,
        })
      ) {
        continue;
      }
      allCount += 1;
      counts.set(meta.languageKey, (counts.get(meta.languageKey) ?? 0) + 1);
    }
    const options = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (a.value === UNKNOWN_LANGUAGE_VALUE) return 1;
        if (b.value === UNKNOWN_LANGUAGE_VALUE) return -1;
        return b.count - a.count || a.value.localeCompare(b.value);
      });
    return { options, allCount };
  }, [hidePenalized, issueMetas, minScore, selectedArea, selectedContentLanguage, selectedLabel]);

  const contentFacet = useMemo(() => {
    let english = 0;
    let other = 0;
    for (const meta of issueMetas) {
      if (
        !issueMatchesCriteria(meta, {
          minScore,
          selectedLanguage,
          selectedArea,
          selectedLabel,
          hidePenalized,
        })
      ) {
        continue;
      }
      if (meta.contentLanguage === "english") english += 1;
      else other += 1;
    }
    return { english, other, allCount: english + other };
  }, [hidePenalized, issueMetas, minScore, selectedArea, selectedLabel, selectedLanguage]);

  const areaFacet = useMemo(() => {
    const counts = new Map<string, number>();
    let allCount = 0;
    for (const meta of issueMetas) {
      if (
        !issueMatchesCriteria(meta, {
          minScore,
          selectedLanguage,
          selectedContentLanguage,
          selectedLabel,
          hidePenalized,
        })
      ) {
        continue;
      }
      allCount += 1;
      for (const area of meta.derivedAreas) {
        counts.set(area, (counts.get(area) ?? 0) + 1);
      }
    }
    const options = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { options, allCount };
  }, [hidePenalized, issueMetas, minScore, selectedContentLanguage, selectedLabel, selectedLanguage]);

  const labelFacet = useMemo(() => {
    const counts = new Map<string, number>();
    let allCount = 0;
    for (const meta of issueMetas) {
      if (
        !issueMatchesCriteria(meta, {
          minScore,
          selectedLanguage,
          selectedContentLanguage,
          selectedArea,
          hidePenalized,
        })
      ) {
        continue;
      }
      allCount += 1;
      for (const label of new Set(meta.issue.labels)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    const options = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, 40);
    return { options, allCount };
  }, [hidePenalized, issueMetas, minScore, selectedArea, selectedContentLanguage, selectedLanguage]);

  const activeFilters = useMemo(() => {
    const filters: string[] = [];
    if (minScore > 0) filters.push(`min score >= ${minScore}`);
    if (selectedLanguage !== "all") filters.push(`language: ${selectedLanguage}`);
    if (selectedContentLanguage !== "all") {
      filters.push(`content language: ${selectedContentLanguage === "english" ? "English" : "Others"}`);
    }
    if (selectedArea !== "all") filters.push(`area: ${selectedArea}`);
    if (selectedLabel !== "all") filters.push(`label: ${selectedLabel}`);
    if (hidePenalized) filters.push("hide penalized");
    return filters;
  }, [hidePenalized, minScore, selectedArea, selectedContentLanguage, selectedLabel, selectedLanguage]);

  function resetFilters() {
    setMinScore(0);
    setSelectedLanguage("all");
    setSelectedContentLanguage("all");
    setSelectedArea("all");
    setSelectedLabel("all");
    setHidePenalized(false);
    setCurrentPage(1);
  }

  const groupedIssues = useMemo(() => groupIssuesByRepo(filteredIssues), [filteredIssues]);
  const visiblePanelGroups = useMemo(() => groupedIssues.slice(0, pageSize), [groupedIssues, pageSize]);
  const visibleListIssues = useMemo(() => filteredIssues.slice(0, pageSize), [filteredIssues, pageSize]);
  const totalServerPages = Math.max(1, Math.ceil(Math.max(serverTotalCount, issues.length) / serverPerPage));
  const maxPageForUi = Math.min(totalServerPages, MAX_BROWSABLE_PAGES);
  const hasNextServerPage = currentPage < maxPageForUi;

  useEffect(() => {
    if (currentPage > maxPageForUi) {
      setCurrentPage(maxPageForUi);
    }
  }, [currentPage, maxPageForUi]);

  useEffect(() => {
    let cancelled = false;

    async function loadIssues() {
      try {
        setIsLoading(true);
        setError(null);
        const isDebugEnabled = ["1", "true", "yes", "on"].includes(
          new URLSearchParams(window.location.search).get("debug")?.toLowerCase() ?? ""
        );
        const issuesParams = new URLSearchParams({
          perPage: String(serverPerPage),
          page: String(currentPage),
        });
        if (isDebugEnabled) {
          issuesParams.set("debug", "1");
        }
        const issuesUrl = `/api/issues/search?${issuesParams.toString()}`;

        const [issuesResponse, preferencesResponse] = await Promise.all([
          fetch(issuesUrl),
          fetch("/api/preferences"),
        ]);

        const issuesContentType = issuesResponse.headers.get("content-type") ?? "";
        const issuesIsJson = issuesContentType.includes("application/json");
        const data = issuesIsJson ? ((await issuesResponse.json()) as SearchIssuesResponse) : null;

        if (!issuesResponse.ok) {
          if (data?.error) {
            throw new Error(data.error);
          }

          const fallbackText = await issuesResponse.text();
          throw new Error(fallbackText || "Failed to load issues");
        }

        if (!data) {
          throw new Error("Invalid response format from /api/issues/search");
        }
        if (!Array.isArray(data.items)) {
          throw new Error("Invalid response payload: items must be an array");
        }

        if (!cancelled) {
          setIssues(data.items);
          const safeTotalCount =
            Number.isFinite(data.totalCount) && data.totalCount > 0 ? data.totalCount : data.items.length;
          setServerTotalCount(safeTotalCount);

          if (preferencesResponse.ok) {
            const prefData = (await preferencesResponse.json()) as PreferenceResponse;
            setPreferences({
              preferredLanguages: prefData.preferredLanguages ?? [],
              preferredAreas: prefData.preferredAreas ?? [],
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load issues";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadIssues();

    return () => {
      cancelled = true;
    };
  }, [currentPage, serverPerPage, reloadToken]);

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Discover Issues</h1>
        <p className="text-base leading-7 text-gray-600">Beginner-friendly issues matched to your onboarding preferences.</p>
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
          Disclaimer: Please review repository and issue details before cloning or running code, and use your usual development safety practices.
        </div>
      </div>

      {!isLoading && !error && issues.length > 0 ? (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
            <label className="space-y-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">View</span>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="rounded-md border px-3 py-2 text-sm font-medium"
              >
                <option value="panel">Panel (grouped by repo)</option>
                <option value="list">List (flat issues)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Items per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm font-medium"
              >
                {PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {/* <p className="text-xs text-gray-500">
              Server page {currentPage}, loaded {issues.length} issue{issues.length === 1 ? "" : "s"}.
              {viewMode === "panel"
                ? ` Showing ${visiblePanelGroups.length} repo group${visiblePanelGroups.length === 1 ? "" : "s"} after filters.`
                : ` Showing ${visibleListIssues.length} issue${visibleListIssues.length === 1 ? "" : "s"} on this page after filters.`}
              {serverTotalCount > 0 ? ` Total candidates: ${serverTotalCount}.` : ""}
            </p> */}
          </div>

          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm md:grid-cols-6">
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Min score: {minScore}</span>
              <input
                type="range"
                min={0}
                max={minScoreSliderMax}
                step={1}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full"
              />
            </label>

          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Repo language</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              <option value="all">All languages ({languageFacet.allCount})</option>
              {selectedLanguage !== "all" && !languageFacet.options.some((option) => option.value === selectedLanguage) ? (
                <option value={selectedLanguage}>
                  {selectedLanguage === UNKNOWN_LANGUAGE_VALUE ? UNKNOWN_LANGUAGE_LABEL : selectedLanguage} (0)
                </option>
              ) : null}
              {languageFacet.options.map((language: FilterOption) => (
                <option key={language.value} value={language.value}>
                  {language.value === UNKNOWN_LANGUAGE_VALUE ? UNKNOWN_LANGUAGE_LABEL : language.value} ({language.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Content language</span>
            <select
              value={selectedContentLanguage}
              onChange={(e) => setSelectedContentLanguage(e.target.value as ContentLanguageOption)}
              className="w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              <option value="all">All ({contentFacet.allCount})</option>
              <option value="english">English ({contentFacet.english})</option>
              <option value="other">Others ({contentFacet.other})</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Area</span>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              <option value="all">All areas ({areaFacet.allCount})</option>
              {selectedArea !== "all" && !areaFacet.options.some((option) => option.value === selectedArea) ? (
                <option value={selectedArea}>{selectedArea} (0)</option>
              ) : null}
              {areaFacet.options.map((area: FilterOption) => (
                <option key={area.value} value={area.value}>
                  {area.value} ({area.count})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Label</span>
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm font-medium"
            >
              <option value="all">All labels ({labelFacet.allCount})</option>
              {selectedLabel !== "all" && !labelFacet.options.some((option) => option.value === selectedLabel) ? (
                <option value={selectedLabel}>{selectedLabel} (0)</option>
              ) : null}
              {labelFacet.options.map((label: FilterOption) => (
                <option key={label.value} value={label.value}>
                  {label.value} ({label.count})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              checked={hidePenalized}
              onChange={(e) => setHidePenalized(e.target.checked)}
            />
            <span className="text-sm font-semibold text-gray-800">Hide penalized issues</span>
            <button
              type="button"
              onClick={() => setIsPenaltyInfoOpen(true)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold leading-none text-gray-700 hover:bg-gray-50"
              aria-label="How penalized issues are determined"
              title="How penalized issues are determined"
            >
              i
            </button>
          </label>

            <button
              type="button"
              onClick={resetFilters}
              className="self-end rounded-md border px-3 py-2 text-sm font-semibold transition hover:bg-gray-50"
            >
              Reset filters
            </button>
          </div>
        </>
      ) : null}

      {isLoading ? <p>Loading issues...</p> : null}
      {error ? (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((prev) => prev + 1)}
            className="rounded border border-red-300 bg-white px-3 py-1 text-sm"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && issues.length === 0 ? (
        <p className="text-gray-600">No matching issues found. Try updating your onboarding preferences.</p>
      ) : null}

      {!isLoading && !error && issues.length > 0 && filteredIssues.length === 0 ? (
        <div className="space-y-1 text-sm leading-6 text-gray-600">
          <p>
            No issues match the current filters
            {activeFilters.length > 0 ? ` (${activeFilters.join(", ")})` : ""}. Try resetting filters or lowering min
            score.
          </p>
          {hasNextServerPage ? <p className="text-xs">You can also try the next server page for more candidates.</p> : null}
        </div>
      ) : null}

      {!isLoading && !error && filteredIssues.length > 0 ? (
        viewMode === "panel" ? (
        <ul className="space-y-4">
          {visiblePanelGroups.map((group) => {
            const theme = getRepoColorTheme(group.repoFullName);
            return (
            <li key={group.repoFullName} className={`rounded-lg border p-4 ${theme.panel}`}>
              <div className={`mb-3 rounded-md border p-3 ${theme.header}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${theme.mutedText}`}>Repository</p>
                    <a
                      href={group.issues[0]?.repoHomepageUrl ?? group.issues[0]?.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-lg font-bold leading-7 hover:underline ${theme.accentText}`}
                    >
                      {group.issues[0]?.repoDisplayFullName ?? group.repoFullName}
                    </a>
                    {group.issues[0]?.repoDescription ? (
                      <p className="text-sm leading-6 text-gray-700">{group.issues[0].repoDescription}</p>
                    ) : null}
                    {(group.issues[0]?.repoTechStack?.length ?? 0) > 0 ? (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Tech stack</p>
                        <div className="flex flex-wrap gap-2">
                          {group.issues[0].repoTechStack?.map((tag) => (
                            <span
                              key={`${group.repoFullName}-stack-${tag}`}
                              className={`rounded-full border px-2 py-1 text-xs ${theme.softBadge}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    {group.issues.length} recommendation{group.issues.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className={`ml-2 space-y-4 border-l-4 pl-4 ${theme.connector}`}>
                {group.issues.slice(0, 1).map((issue) => (
                  <article key={issue.githubIssueId} className={`rounded-md border p-3 ${theme.issueCard}`}>
                    {(() => {
                      const { matchedLabels, otherLabels, hasRepoLanguageMatch, inferredAreaMatches } = getLabelMatches(
                        issue,
                        preferences
                      );
                      const scoreTone = getScoreTone(issue.score.finalScore);

                      return (
                        <>
                          <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${theme.mutedText}`}>
                            Top recommendation in this repo
                          </p>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Issue #{issue.issueNumber}
                          </p>
                          <div className="flex items-start justify-between gap-4">
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-lg font-bold leading-7 text-gray-900 hover:underline"
                            >
                              {issue.title}
                            </a>
                            <button
                              type="button"
                              onClick={() => setSelectedIssue(issue)}
                              className="shrink-0 rounded-full border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                              title="Click to see score breakdown"
                              aria-label={`Open score details for ${issue.title}`}
                            >
                              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreTone.pill}`}>
                                Score {issue.score.finalScore}
                              </span>{" "}
                              Details
                            </button>
                          </div>
                          <p className="mt-1 text-xs font-medium text-gray-500">Updated {formatDate(issue.updatedAt)}</p>
                          <p className="mt-2 text-sm leading-6 text-gray-700">{issue.score.explanationText}</p>

                          {hasRepoLanguageMatch && issue.repoPrimaryLanguage ? (
                            <div className="mt-3">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">Matched language</p>
                              <span className="rounded-full border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700">
                                {issue.repoPrimaryLanguage}
                              </span>
                            </div>
                          ) : null}

                          {matchedLabels.length > 0 ? (
                            <div className="mt-3">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700">Matched labels</p>
                              <div className="flex flex-wrap gap-2">
                                {matchedLabels.map((label) => (
                                  <span
                                    key={`${issue.githubIssueId}-matched-${label}`}
                                    className="rounded-full border border-green-300 bg-green-50 px-2 py-1 text-xs text-green-700"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {matchedLabels.length === 0 && inferredAreaMatches.length > 0 ? (
                            <div className="mt-3">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Inferred area matches (from title/body)
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {inferredAreaMatches.map((area) => (
                                  <span
                                    key={`${issue.githubIssueId}-inferred-${area}`}
                                    className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700"
                                  >
                                    {area}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {otherLabels.length > 0 ? (
                            <div className="mt-3">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">Other repo labels</p>
                              <div className="flex flex-wrap gap-2">
                                {otherLabels.map((label) => (
                                  <span
                                    key={`${issue.githubIssueId}-other-${label}`}
                                    className="rounded-full border px-2 py-1 text-xs"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </article>
                ))}

                {group.issues.length > 1 ? (
                  <details className={`rounded-md border p-3 ${theme.details}`}>
                    <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                      View {group.issues.length - 1} more issue{group.issues.length - 1 > 1 ? "s" : ""} from this repo
                    </summary>
                    <p className={`mt-2 text-[11px] font-medium uppercase tracking-wide ${theme.mutedText}`}>
                      Additional repo issues
                    </p>
                    <ul className="mt-3 space-y-3">
                      {group.issues.slice(1).map((issue) => (
                        <li key={issue.githubIssueId} className={`rounded-md border p-3 ${theme.issueCard}`}>
                          {(() => {
                            const scoreTone = getScoreTone(issue.score.finalScore);
                            return (
                              <>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Issue #{issue.issueNumber}
                          </p>
                          <div className="flex items-start justify-between gap-4">
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-base font-semibold leading-6 text-gray-900 hover:underline"
                            >
                              {issue.title}
                            </a>
                            <button
                              type="button"
                              onClick={() => setSelectedIssue(issue)}
                              className="shrink-0 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
                              title="Click to see score breakdown"
                              aria-label={`Open score details for ${issue.title}`}
                            >
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${scoreTone.pill}`}>
                                Score {issue.score.finalScore}
                              </span>
                            </button>
                          </div>
                          <p className="mt-1 text-xs font-medium text-gray-500">Updated {formatDate(issue.updatedAt)}</p>
                              </>
                            );
                          })()}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
        ) : (
          <ul className="space-y-3">
            {visibleListIssues.map((issue) => {
              const theme = getRepoColorTheme(issue.repoFullName);
              const scoreTone = getScoreTone(issue.score.finalScore);
              return (
              <li key={issue.githubIssueId} className={`rounded-lg border p-4 ${theme.panel}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {issue.repoDisplayFullName ?? issue.repoFullName} - Issue #{issue.issueNumber}
                </p>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lg font-bold leading-7 text-gray-900 hover:underline"
                  >
                    {issue.title}
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelectedIssue(issue)}
                    className="shrink-0 rounded-full border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    title="Click to see score breakdown"
                    aria-label={`Open score details for ${issue.title}`}
                  >
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${scoreTone.pill}`}>
                      Score {issue.score.finalScore}
                    </span>
                  </button>
                </div>
                <p className="mt-1 text-xs font-medium text-gray-500">Updated {formatDate(issue.updatedAt)}</p>
                {issue.repoDescription ? <p className="mt-2 text-sm leading-6 text-gray-700">{issue.repoDescription}</p> : null}
              </li>
              );
            })}
          </ul>
        )
      ) : null}

      {!isLoading && !error && issues.length > 0 ? (
        <div className="space-y-2 rounded-md border px-3 py-2 text-sm leading-6">
          <div className="flex items-center justify-between">
            <p>
              {activeFilters.length > 0
                ? `Page ${currentPage}    (Filtered view)`
                : `Page ${currentPage} / ${
                    totalServerPages > MAX_BROWSABLE_PAGES ? `${MAX_BROWSABLE_PAGES}+` : totalServerPages
                  }`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="rounded border px-2 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(maxPageForUi, prev + 1))}
                disabled={!hasNextServerPage || isLoading}
                className="rounded border px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {filteredIssues.length} match{filteredIssues.length === 1 ? "" : "es"} on this page with current filters
          </p>
          <p className="text-xs text-gray-500">Showing top ranked pages for relevance and rate-limit efficiency</p>
        </div>
      ) : null}

      <SimpleModal
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        title={selectedIssue ? `Why "${selectedIssue.title}" scored ${selectedIssue.score.finalScore}` : "Score details"}
      >
        {selectedIssue ? (
          <>
            <p>
              Final score = freshness + repo health + clarity + accessibility/newcomer-friendliness + tech match + skill fit + issue size fit -
              penalty
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Freshness: {selectedIssue.score.freshnessScore}</p>
              <p>Repo health: {selectedIssue.score.repoHealthScore}</p>
              <p>Clarity: {selectedIssue.score.clarityScore}</p>
              <p>Accessibility / newcomer-friendliness: {selectedIssue.score.beginnerFitScore}</p>
              <p>Tech match: {selectedIssue.score.techMatchScore}</p>
              <p>Skill fit: {selectedIssue.score.skillFitScore}</p>
              <p>Issue size fit: {selectedIssue.score.issueSizeFitScore}</p>
              <p>Difficulty: {selectedIssue.score.difficultyScore} ({selectedIssue.score.difficultyBand})</p>
              <p>Penalty: -{selectedIssue.score.penaltyScore}</p>
              <p className="font-semibold">Final score: {selectedIssue.score.finalScore}</p>
            </div>
            <p>{selectedIssue.score.explanationText}</p>
          </>
        ) : null}
      </SimpleModal>

      <SimpleModal
        isOpen={isPenaltyInfoOpen}
        onClose={() => setIsPenaltyInfoOpen(false)}
        title="How Penalized Issues Are Determined"
      >
        <p>Penalty is subtracted from the final score and is capped at 30 points.</p>
        <p>
          Penalties currently increase for: stale issues (based on last update date), assigned issues (more assignees),
          and very high comment counts (higher discussion complexity).
        </p>
        <p>
          “Hide penalized issues” hides any issue where penalty is greater than 0, even if the penalty is small.
        </p>
      </SimpleModal>
    </section>
  );
}