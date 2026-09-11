# Task Dashboard (Next.js + Postgres)

Mobile-responsive task dashboard backed by Postgres. It is also the API behind the Sydney Telegram
assistant (`melissa-bot`), which authenticates with `OPENCLAW_API_SECRET`.

## Deploying

Vercel builds every push to `main`. The project serves `task-dashboard-c7q2.vercel.app` and lives
in the **Berkeley** Vercel account — *not* the personal one, even though the repo is
`slabarcaf/task-dashboard` on personal GitHub.

> ⚠️ **There is a second Vercel project that looks like this one.** The personal account holds an
> unrelated old create-react-app, also named `task-dashboard`, still serving at
> `task-dashboard.vercel.app`. On 2026-09-11 two API keys were added to it by mistake and three
> redeploys later production still could not see them.
>
> **How to be sure you are in the right one:** its Deployments tab shows today's commits from
> `slabarcaf/task-dashboard`. If it shows a React app or nothing recent, back out.
>
> The full account map — who owns Neon, Google Cloud, OpenAI, Resend — is in `melissa-bot/README.md`
> under "Which account owns what", with a how-to-check for every row.

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

## Optional keys

Two features are built and degrade honestly when their key is missing — the UI
says what is absent rather than reporting a failure or, worse, a false success.

These go in the **Berkeley** Vercel account's project (see the warning above).

| Variable | Turns on | Without it |
|---|---|---|
| `OPENAI_API_KEY` | Voice notes on the web (Whisper, the same one the bot uses) | The mic returns 503 and the toast says the feature is not configured |
| `RESEND_API_KEY` | The invitation email | The account is still created, and the admin screen hands over a message to send by hand |
| `INVITE_FROM` | The sender address | Falls back to `onboarding@resend.dev`, which Resend allows without a verified domain |
| `NEXT_PUBLIC_TELEGRAM_BOT` | The bot handle used in link/QR/invite URLs | Falls back to `Melizion_bot` |
| `ADMIN_EMAILS` | Who sees `/admin`, comma-separated | Falls back to `DEFAULT_OWNER_EMAIL` |

**A variable does nothing until a new build.** After saving one, redeploy. And `/admin` shows an
**Integraciones** block that says, in green or red, whether each key actually reached the running
build — which is faster than guessing and is what finally located the wrong-project mistake.

## Voice notes

Hold the mic in the capture bar to record, release to transcribe; a short tap
latches recording open until the next tap, because holding a finger down for
thirty seconds on a desktop is nobody's idea of a good time.

**The transcript lands in the text field, never straight into a task.** Whisper
mishears, and a task created silently from a misheard phrase is worse than
having no voice at all — you find out the day the reminder does not come.

The Whisper prompt is built per user in `src/lib/voicePrompt.ts`: generic task
vocabulary (without it, "con vencimiento mañana" reliably becomes
"Convencimiento mañana") plus that person's own category names. `melissa.js`
mirrors the same rule, so a voice note transcribes identically on both sides.
