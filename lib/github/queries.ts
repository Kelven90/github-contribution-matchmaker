import { SEARCH_QUERY_LIMITS } from "@/lib/config/search";
import { GitHubDebugCollector, githubRequest } from "@/lib/github/client";

type SearchPreferences = {
  skillLevel: string;
  preferredLanguages: string[];
  preferredAreas: string[];
  preferredIssueSize: string;
  activeReposOnly: boolean;
};

type QueryOptions = {
  includeLanguages?: boolean;
  includeAreas?: boolean;
};

export type GitHubIssueSearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubIssueItem[];
};

export type GitHubIssueItem = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  comments: number;
  created_at: string;
  updated_at: string;
  assignee: { login: string } | null;
  assignees: { login: string }[];
  labels: Array<{ name?: string } | string>;
  repository_url: string;
  user: { login: string };
  repository?: {
    id: number;
    full_name: string;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    pushed_at: string | null;
  };
};

const AREA_LABEL_HINTS: Record<string, string[]> = {
  frontend: ["frontend", "ui", "ux"],
  backend: ["backend", "api", "server"],
  docs: ["documentation", "docs"],
  testing: ["test", "testing", "qa"],
  devops: ["devops", "ci", "cd", "deployment", "infrastructure"],
  security: ["security", "vulnerability", "auth", "permission"],
  data: ["data", "etl", "pipeline", "analytics", "database"],
  mobile: ["mobile", "android", "ios", "react-native", "flutter"],
  performance: ["performance", "optimization", "latency", "benchmark"],
  accessibility: ["accessibility", "a11y", "wcag", "screen reader"],
};

function quoteIfNeeded(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[^a-zA-Z0-9_\-+.]/.test(trimmed) ? `"${trimmed.replaceAll("\"", "")}"` : trimmed;
}

function buildLanguageQualifier(preferredLanguages: string[]) {
  const normalizedLanguages = Array.from(
    new Set(
      preferredLanguages
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, SEARCH_QUERY_LIMITS.MAX_LANGUAGE_TERMS);

  if (normalizedLanguages.length === 0) return "";
  if (normalizedLanguages.length === 1) return `language:${quoteIfNeeded(normalizedLanguages[0])}`;

  const disjunction = normalizedLanguages.map((language) => `language:${quoteIfNeeded(language)}`).join(" OR ");
  return `(${disjunction})`;
}

function buildAreaQualifier(preferredAreas: string[]) {
  if (preferredAreas.length === 0) return "";

  const labelTerms = preferredAreas
    .flatMap((area) => AREA_LABEL_HINTS[area] ?? [area])
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label, index, arr) => arr.indexOf(label) === index)
    .slice(0, SEARCH_QUERY_LIMITS.MAX_AREA_TERMS)
    .map((label) => `label:${quoteIfNeeded(label)}`);

  if (labelTerms.length === 0) return "";
  if (labelTerms.length === 1) return labelTerms[0];

  return `(${labelTerms.join(" OR ")})`;
}

export function buildIssueSearchQuery(preferences: SearchPreferences, options: QueryOptions = {}) {
  const {
    includeLanguages = true,
    includeAreas = true,
  } = options;

  const baseTerms = ["is:issue", "is:open", "archived:false", "label:\"good first issue\""];

  let optionalTerms = [
    includeLanguages ? buildLanguageQualifier(preferences.preferredLanguages) : "",
    includeAreas ? buildAreaQualifier(preferences.preferredAreas) : "",
  ].filter(Boolean);

  // GitHub Search rejects queries with too many boolean operators (AND/OR/NOT).
  let booleanOperatorCount = optionalTerms.reduce((count, term) => count + (term.match(/\bOR\b/g)?.length ?? 0), 0);
  if (booleanOperatorCount > SEARCH_QUERY_LIMITS.MAX_BOOLEAN_OPERATORS) {
    optionalTerms = optionalTerms.filter((term) => !term.includes(" OR "));
    booleanOperatorCount = optionalTerms.reduce((count, term) => count + (term.match(/\bOR\b/g)?.length ?? 0), 0);
    if (booleanOperatorCount > SEARCH_QUERY_LIMITS.MAX_BOOLEAN_OPERATORS) {
      optionalTerms = [];
    }
  }

  return [...baseTerms, ...optionalTerms].join(" ");
}

export async function searchGitHubIssues(
  query: string,
  perPage = 20,
  page = 1,
  debugCollector?: GitHubDebugCollector
) {
  const searchParams = new URLSearchParams({
    q: query,
    sort: "updated",
    order: "desc",
    per_page: String(perPage),
    page: String(Math.max(1, Math.floor(page))),
  });

  return githubRequest<GitHubIssueSearchResponse>("/search/issues", searchParams, debugCollector);
}

type GitHubRepoResponse = {
  name?: string;
  full_name?: string;
  html_url?: string;
  description?: string | null;
  language: string | null;
  topics?: string[];
};

type GitHubRepoLanguagesResponse = Record<string, number>;

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

const EXCLUDED_TECH_TAG_PATTERNS = [
  "good-first",
  "first-",
  "beginner",
  "contribution",
  "contribute",
  "open-source",
  "up-for-grabs",
  "help-wanted",
  "hacktoberfest",
  "community",
  "for-beginners",
  "learn-",
  "language-learning",
  "japanese-language",
  "japanese",
  "english",
  "spanish",
  "mandarin",
];

const KNOWN_TECH_TAGS = new Set([
  "typescript",
  "javascript",
  "python",
  "java",
  "go",
  "rust",
  "c",
  "cpp",
  "csharp",
  "kotlin",
  "swift",
  "ruby",
  "php",
  "scala",
  "haskell",
  "react",
  "nextjs",
  "next-js",
  "vue",
  "angular",
  "svelte",
  "nodejs",
  "node",
  "express",
  "nestjs",
  "django",
  "flask",
  "spring",
  "laravel",
  "rails",
  "prisma",
  "postgres",
  "postgresql",
  "mysql",
  "sqlite",
  "mongodb",
  "redis",
  "graphql",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "tailwind",
  "tailwindcss",
  "react-native",
  "flutter",
]);

function isLikelyTechTag(tag: string) {
  if (!tag) return false;
  if (EXCLUDED_TECH_TAG_PATTERNS.some((pattern) => tag.includes(pattern))) return false;
  if (KNOWN_TECH_TAGS.has(tag)) return true;

  // Accept compact tech-ish tokens like "webassembly", "terraform", "eslint", "vite".
  if (/^[a-z0-9][a-z0-9+.-]{1,24}$/.test(tag) && !tag.includes(" ")) {
    return true;
  }

  return false;
}

export type RepositoryDetails = {
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  primaryLanguage: string | null;
  techStack: string[];
};

export async function fetchRepositoryDetails(
  repoFullName: string,
  debugCollector?: GitHubDebugCollector
): Promise<RepositoryDetails> {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    return {
      name: repo || repoFullName,
      fullName: repoFullName,
      htmlUrl: `https://github.com/${repoFullName}`,
      description: null,
      primaryLanguage: null,
      techStack: [],
    };
  }

  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const response = await githubRequest<GitHubRepoResponse>(path, undefined, debugCollector);
  let topLanguages: string[] = [];

  // Use GitHub's own language breakdown when available/needed.
  // We only fetch this when the primary language is missing to keep API calls efficient.
  if (!response.language) {
    try {
      const languages = await githubRequest<GitHubRepoLanguagesResponse>(`${path}/languages`, undefined, debugCollector);
      topLanguages = Object.entries(languages)
        .filter(([, bytes]) => Number.isFinite(bytes) && bytes > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([language]) => language)
        .slice(0, 4);
    } catch {
      topLanguages = [];
    }
  }

  const tags = [
    response.language ?? topLanguages[0] ?? "",
    ...topLanguages,
    ...(response.topics ?? []),
  ]
    .map(normalizeTag)
    .filter(isLikelyTechTag)
    .filter(Boolean);

  return {
    name: response.name ?? repo,
    fullName: response.full_name ?? repoFullName,
    htmlUrl: response.html_url ?? `https://github.com/${repoFullName}`,
    description: response.description ?? null,
    primaryLanguage: response.language ?? topLanguages[0] ?? null,
    techStack: Array.from(new Set(tags)),
  };
}
