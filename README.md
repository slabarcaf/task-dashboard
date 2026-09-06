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

## Admin

`/admin` lists every account: who exists, whether they finished onboarding, whether Telegram is
connected, and how many tasks they have — created, pending, overdue, priority — plus when they last
signed in and last touched a task.

Who is an admin comes from `ADMIN_EMAILS` (comma-separated). When it is unset it falls back to
`DEFAULT_OWNER_EMAIL`, so the owner is the admin by default and nothing has to be configured.

Three actions: repeat onboarding, disconnect Telegram, and delete the account.

> **The admin API accepts a browser session only — never `OPENCLAW_API_SECRET`.** The bot's bearer
> token resolves to the owner account, and the owner is the admin, so honouring it there would turn
> one static string in the bot's `config.json` into a key to everyone's summary. Admin is something
> a person is signed in as, not something a service can hold.

Deleting an account removes its tasks **first, in the same transaction**. `tasks.user_id` is
`ON DELETE SET NULL`, so removing the user row alone would leave the tasks ownerless — and
`ensureOwnerUserAndBackfill` sweeps every ownerless task into the owner account on the next boot. A
"deleted" user's tasks would quietly reappear in the owner's list.

## Tests

```bash
npm test
```

`node --test` over `tests/*.test.mjs`. Today it covers the quick-capture date
parser, which is the piece where a silent mistake is most expensive: a wrong date
looks fine until the reminder fires on the wrong day.

## Keyboard

`⌘K` or `/` opens the command palette, `n` jumps to quick capture, `Escape`
closes a dialog, `⌘↵` saves the edit dialog. Single-letter shortcuts are ignored
while you are typing.

## UI lab

`/ui-lab` renders the presentational components against fixed rows — no database, no session, no
API. It exists because the signed-in surface can only be reached with a Google account, which makes
redesigning it hard to verify. Deleting it costs the app no behaviour.
