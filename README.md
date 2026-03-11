# GitHub Contribution Matchmaker

## Problem Statement

Finding a first open-source issue on GitHub is harder than it looks:

- `good first issue` search results are often stale, noisy, or not truly beginner-friendly
- many issues are already assigned, unclear, or from low-activity repositories
- GitHub search is powerful, but not personalized to each contributor's skill and goals

This project focuses on a practical question:
**"Given my current skills and interests, which issue should I try first?"**

## What This Project Does

Instead of returning raw search results, the app:

1. Collects candidate issues from GitHub
2. Enriches each issue with repository metadata
3. Scores and ranks each issue with transparent heuristics
4. Lets users filter results in a UI optimized for discovery
5. Explains *why* each issue is recommended

## Techniques Used

### 1) Preference-driven retrieval

- Onboarding captures:
  - skill level
  - preferred languages
  - preferred contribution areas
  - preferred issue size
  - active-repo preference
- Query building uses strict + fallback variants to avoid over-narrowing results.

### 2) Rule-based scoring engine (transparent)

Each issue gets a composite score from multiple interpretable signals:

- freshness
- repository health
- issue clarity
- accessibility/newcomer-friendliness
- tech match
- skill fit
- issue size fit
- penalties (stale / assigned / high discussion overhead)

The UI exposes score details so users can understand recommendations, not just trust a black box.

### 3) Heuristic enrichment

- Label-based area matching with title/body keyword fallback
- Repository language + tech stack enrichment
- Faceted filtering on the client from server-provided candidate pages

### 4) Rate-limit-aware GitHub usage

- response caching
- query complexity guards
- progressive server-side pagination
- request shaping to reduce unnecessary API pressure

## Tech Stack

- Next.js (App Router) + TypeScript
- Prisma 7 + PostgreSQL
- Tailwind CSS
- GitHub REST API

## Architecture (High Level)

- `app/api/issues/search` - search + enrichment + ranking pipeline
- `lib/github/*` - API client, query builder, response mappers
- `lib/scoring/*` - scoring modules and aggregate score calculation
- `components/onboarding/PreferenceForm` - preference capture and persistence
- `app/discover/page` - filtered, explainable recommendation UI

## Prerequisites

- Node.js 20+
- Docker Desktop
- A GitHub personal access token (recommended to avoid strict rate limits)

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Create `github-contribution-matchmaker/.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/github_contrib_match?schema=public"
GITHUB_TOKEN="ghp_your_token_here"
```

Notes:
- Never commit `.env*` files.
- `GITHUB_TOKEN` can be blank for basic testing, but results will be more rate-limited.

## 3) Start PostgreSQL

```bash
docker compose up -d
```

## 4) Generate Prisma client + apply schema

```bash
npm run db:generate
npm run db:push
```

If you prefer migrations:

```bash
npm run db:migrate
```

## 5) Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

- `npm run typecheck` - TypeScript check
- `npm run lint` - ESLint
- `npm run build` - production build
- `npm run db:studio` - Prisma Studio

## Deployment notes

- Set `DATABASE_URL` and `GITHUB_TOKEN` in your hosting platform.
- Ensure Prisma client is generated during build (`prebuild` already runs `db:generate`).

## Safety note

This tool recommends repositories/issues, but users should still review code before cloning/running anything locally and follow standard development security practices.
