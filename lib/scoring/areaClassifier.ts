import { ContributionArea } from "@/types/preferences";

const AREA_TEXT_HINTS: Record<string, string[]> = {
  frontend: [
    "frontend",
    "ui",
    "ux",
    "component",
    "css",
    "scss",
    "sass",
    "styled-components",
    "chakra",
    "material ui",
    "mui",
    "bootstrap",
    "tailwind",
    "react",
    "reactjs",
    "vue",
    "vuejs",
    "angular",
    "svelte",
    "next.js",
    "nextjs",
    "vite",
    "html",
    "dom",
    "browser",
    "client-side",
    "accessibility",
    "a11y",
    "layout",
    "page",
  ],
  backend: [
    "backend",
    "api",
    "rest",
    "graphql",
    "gql",
    "rpc",
    "server",
    "microservice",
    "endpoint",
    "database",
    "sql",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "prisma",
    "orm",
    "typeorm",
    "sequelize",
    "drizzle",
    "knex",
    "query",
    "auth",
    "jwt",
    "oauth",
    "session",
    "middleware",
    "webhook",
    "cron",
    "queue",
    "worker",
  ],
  docs: [
    "docs",
    "documentation",
    "readme",
    "markdown",
    ".md",
    "changelog",
    "contributing",
    "code of conduct",
    "faq",
    "guide",
    "tutorial",
    "wiki",
    "comment",
    "typo",
    "spelling",
  ],
  testing: [
    "test",
    "testing",
    "unit test",
    "integration test",
    "e2e",
    "end-to-end",
    "regression test",
    "test case",
    "mock",
    "fixture",
    "assertion",
    "jest",
    "vitest",
    "playwright",
    "cypress",
    "mocha",
    "chai",
    "pytest",
    "unittest",
    "integration suite",
    "coverage",
  ],
  devops: [
    "devops",
    "ci",
    "cd",
    "github actions",
    "docker",
    "kubernetes",
    "helm",
    "terraform",
    "deployment",
  ],
  security: [
    "security",
    "vulnerability",
    "xss",
    "csrf",
    "injection",
    "authentication",
    "authorization",
    "secrets",
    "dependency audit",
  ],
  data: [
    "data",
    "etl",
    "pipeline",
    "analytics",
    "warehouse",
    "dataset",
    "schema",
    "migration",
  ],
  mobile: [
    "mobile",
    "android",
    "ios",
    "react native",
    "flutter",
    "kotlin",
    "swift",
  ],
  performance: [
    "performance",
    "latency",
    "throughput",
    "benchmark",
    "optimize",
    "profiling",
    "memory leak",
    "cpu",
  ],
  accessibility: [
    "accessibility",
    "a11y",
    "wcag",
    "screen reader",
    "aria",
    "keyboard navigation",
    "color contrast",
  ],
};

function normalize(value: string) {
  return value.toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function textContainsKeyword(text: string, keyword: string) {
  const normalizedText = normalize(text);
  const normalizedKeyword = normalize(keyword).trim();

  if (!normalizedKeyword) return false;
  if (normalizedKeyword.length <= 2) {
    // For short terms such as "ai", require token boundaries.
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`, "i");
    return pattern.test(normalizedText);
  }

  return normalizedText.includes(normalizedKeyword);
}

export function hasAreaLabelMatch(labels: string[], area: ContributionArea) {
  const labelHints = AREA_TEXT_HINTS[area] ?? [area];
  const loweredLabels = labels.map(normalize);
  return loweredLabels.some((label) => labelHints.some((hint) => textContainsKeyword(label, hint)));
}

export function hasAreaTextMatch(input: { title: string; body?: string | null; labels?: string[] }, area: ContributionArea) {
  const labelHints = AREA_TEXT_HINTS[area] ?? [area];
  const combinedText = `${input.title} ${input.body ?? ""} ${(input.labels ?? []).join(" ")}`;
  return labelHints.some((hint) => textContainsKeyword(combinedText, hint));
}

export function inferIssueAreasFromText(input: {
  title: string;
  body?: string | null;
  labels?: string[];
}): ContributionArea[] {
  const text = normalize(`${input.title} ${input.body ?? ""} ${(input.labels ?? []).join(" ")}`);
  const inferred = new Set<ContributionArea>();

  (Object.keys(AREA_TEXT_HINTS) as ContributionArea[]).forEach((area) => {
    const hints = AREA_TEXT_HINTS[area];
    if (hints.some((hint) => textContainsKeyword(text, hint))) {
      inferred.add(area);
    }
  });

  return Array.from(inferred);
}
