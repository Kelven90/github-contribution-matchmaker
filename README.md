# GitHub Contribution Matchmaker

A Next.js + Prisma app that recommends beginner-friendly open-source issues based on onboarding preferences.

## Tech Stack

- Next.js (App Router) + TypeScript
- Prisma 7 + PostgreSQL
- Tailwind CSS
- GitHub REST API

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
