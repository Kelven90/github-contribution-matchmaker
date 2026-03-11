export type QueryVariant = {
  includeLanguages: boolean;
  includeAreas: boolean;
};

export const SEARCH_PAGINATION = {
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 50,
  MIN_PER_QUERY_PAGE: 20,
  MAX_PER_QUERY_PAGE_WITH_TOKEN: 40,
  MAX_PER_QUERY_PAGE_NO_TOKEN: 25,
  TARGET_POOL_MULTIPLIER: 2,
} as const;

export const SEARCH_CACHE = {
  RESPONSE_TTL_MS: 10 * 60 * 1000,
  RESPONSE_STALE_TTL_MS: 60 * 60 * 1000,
  REPO_TECH_TTL_MS: 6 * 60 * 60 * 1000,
} as const;

export const SEARCH_ENRICHMENT = {
  MAX_REPO_TECH_LOOKUPS_WITH_TOKEN: 30,
  MAX_REPO_TECH_LOOKUPS_NO_TOKEN: 12,
  REPO_TECH_LOOKUP_CONCURRENCY: 4,
} as const;

export const SEARCH_QUERY_LIMITS = {
  MAX_BOOLEAN_OPERATORS: 5,
  MAX_LANGUAGE_TERMS: 3,
  MAX_AREA_TERMS: 3,
} as const;

export const AUTHENTICATED_QUERY_VARIANTS: QueryVariant[] = [
  { includeLanguages: true, includeAreas: true },
  { includeLanguages: true, includeAreas: false },
  { includeLanguages: false, includeAreas: false },
];

export const UNAUTHENTICATED_QUERY_VARIANTS: QueryVariant[] = [
  { includeLanguages: true, includeAreas: true },
  { includeLanguages: false, includeAreas: false },
];
