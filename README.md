# Task Dashboard (Next.js + Postgres)

Mobile-responsive task dashboard backed by Postgres. It is also the API behind the Sydney Telegram
assistant (`melissa-bot`), which authenticates with `OPENCLAW_API_SECRET`.

## Deploying

Vercel builds every push to `main` (project `task-dashboard-c7q2`, account `slabarcaf`).

> **Your git commit email must belong to your GitHub account, or the deployment is blocked.**
> Vercel refuses to build a commit whose author it cannot match to a GitHub user, and reports it as
> `Blocked` — not `Error`, so it looks like a limit rather than a config problem. This bit us on
> 2026-09-01: no `user.email` was set, so git invented one from the WiFi hostname
> (`santiagolabarca@wifi-…berkeley.edu`) and three commits were silently refused.
>
> ```bash
> git config --global user.email "207892885+slabarcaf@users.noreply.github.com"
> git config --global user.name  "Santiago Labarca"
> ```
>
> Blocked deployments cannot be un-blocked; push a new commit with a valid author and it ships
> everything before it.

## Stack

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- Postgres via `pg`

## Quick Start

```bash
cd /Users/santiagolabarca/demo/task-dashboard
npm install
cp .env.example .env.local
npm run db:init
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Set these in `.env.local`:

```env
DATABASE_URL=
DEFAULT_OWNER_EMAIL=Santiago.labarca@berkeley.edu
DEFAULT_OWNER_NAME=Santiago Labarca
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Optional, only for one-time data import from Apps Script:
NEXT_PUBLIC_APPS_SCRIPT_URL=
```

## Database Commands

Initialize tables/indexes in Postgres:

```bash
npm run db:init
```

One-time import from existing Apps Script source into Postgres:

```bash
npm run db:migrate:from-sheet
```

## Local API (used by frontend)

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `GET /api/auth/me`
- `POST /api/auth/google`
- `POST /api/auth/logout`

`statusNextStep` is computed server-side from due date + final status.

## Notes

- Main app runtime uses Postgres with per-user task isolation.
- Sign-in uses Google Identity (ID token) and keeps a server session cookie for 15 days.
- Existing imported tasks are attached to `DEFAULT_OWNER_EMAIL` so your account starts with your data.
- `apps-script.gs` is only needed as optional source for one-time migration.
