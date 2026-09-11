# Task Dashboard (Next.js + Postgres)

Mobile-responsive task dashboard backed by Postgres. It is also the API behind the Sydney Telegram
assistant (`melissa-bot`), which authenticates with `OPENCLAW_API_SECRET`.

## ⚠️ Pendiente importante: mover esto a la cuenta personal

**Vercel, Neon y el cliente OAuth de Google están los tres en la cuenta de Berkeley**
(`santiago.labarca@berkeley.edu`). El repositorio está en la personal (`slabarcaf` en GitHub).

Esto no es desorden: es un riesgo con fecha. Es una cuenta universitaria. **El día que se desactive,
el producto pierde a la vez dónde vive, dónde guarda los datos y cómo entra la gente.** No hay copia
de seguridad de eso: no se puede "recuperar" un proyecto de Vercel ni una base de Neon desde una
cuenta a la que ya no entras.

Mover cada servicio es barato hoy y caro o imposible después. Hazlo **uno a la vez, nunca en la misma
sesión que una función nueva**, y verificando entre uno y otro.

### 1. Vercel — el proyecto

*Settings → Advanced → Transfer Project*, desde la cuenta de Berkeley hacia la personal. Vercel
muestra una vista previa de lo que se lleva antes de ejecutar.

| Se transfiere | No se transfiere |
|---|---|
| Los dominios (quedan delegados a la cuenta destino) | Las **integraciones**: hay que volver a conectarlas |
| Las variables de entorno del panel (la vista previa las lista) | Lo definido en `env`/`build.env` de `vercel.json` — aquí no se usa |

**Después de transferir, comprueba en este orden:** que `/admin` → *Integraciones* siga en verde (si
no, faltan variables), que un push a `main` dispare un build, y que el dominio siga respondiendo.

### 2. Neon — la base de datos

Es la más delicada porque tiene los datos. La ruta segura no es "transferir" sino **crear el proyecto
en la cuenta personal, volcar y restaurar con `pg_dump`/`pg_restore`, apuntar `DATABASE_URL` al nuevo
host y recién entonces borrar el viejo**. Guarda el volcado antes de tocar nada.

Ojo con dos cosas: el bot en la VM habla con Postgres **a través de la API**, no directo, así que solo
hay un `DATABASE_URL` que cambiar — el de Vercel. Y el `host` viejo aparece en el mapa de cuentas de
`melissa-bot/README.md`, actualízalo.

### 3. Google Cloud — el cliente OAuth

El más visible para los usuarios: **cambiar de cliente invalida las sesiones**, porque `google_sub`
identifica a cada persona y es distinto entre clientes. Todos tendrían que volver a entrar, y peor,
`upsertGoogleUser` los reconocería por correo pero les escribiría un `google_sub` nuevo.

Antes de hacerlo, lee `upsertGoogleUser` en `src/lib/server/db.ts` y confirma el camino de "mismo
correo, `google_sub` distinto". Es el único de los tres que puede dejar a alguien fuera de su cuenta.

**Orden recomendado:** Vercel primero (reversible y sin datos), Neon después (con volcado),
Google al final y con aviso previo a quien esté usando la app.

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
| `OPENAI_API_KEY` | Voice notes on the web (Whisper, the same one the bot uses) — **live and tested 2026-09-11**: audio in, "Pagar la luz el viernes" out, 2.3s | The mic returns 503 and the toast says the feature is not configured |
| `RESEND_API_KEY` | The invitation email — **live and tested 2026-09-11** | The account is still created, and the admin screen hands over a message to send by hand |
| `INVITE_FROM` | The sender address | Falls back to `onboarding@resend.dev`, which Resend allows without a verified domain |
| `NEXT_PUBLIC_TELEGRAM_BOT` | The bot handle used in link/QR/invite URLs | Falls back to `Melizion_bot` |
| `ADMIN_EMAILS` | Who sees `/admin`, comma-separated | Falls back to `DEFAULT_OWNER_EMAIL` |

**The names are exact.** `OPENAI_API_KEY`, not `OPEN_AI_KEY`; `RESEND_API_KEY`, not `RESEND_KEY`.
If a near-miss name is present, `/admin` names it and says what it should be — that mistake cost an
hour once.

**A variable does nothing until a new build.** After saving one, redeploy. And `/admin` shows an
**Integraciones** block that says, in green or red, whether each key actually reached the running
build — which is faster than guessing and is what finally located the wrong-project mistake.

## Voice notes

Hold the mic in the capture bar to record, release to transcribe; a short tap
latches recording open until the next tap, because holding a finger down for
thirty seconds on a desktop is nobody's idea of a good time.

**The mic only appears on a computer** — `(min-width: 640px) and (pointer: fine)`.
On a phone the voice note goes to Sydney through Telegram: the same Whisper by a
sturdier path, in the app the person is already talking to. Shipping a second,
weaker version of something that sits right next to it is not offering a choice,
it is splitting one feature across two places so that neither is the good one.
iOS Safari records `audio/mp4` rather than `audio/webm`, which is the most
fragile leg of the two and the one hardest to verify. Ajustes says where voice
lives on a phone, so its absence reads as a decision rather than a gap.

**The transcript lands in the text field, never straight into a task.** Whisper
mishears, and a task created silently from a misheard phrase is worse than
having no voice at all — you find out the day the reminder does not come.

The Whisper prompt is built per user in `src/lib/voicePrompt.ts`: generic task
vocabulary (without it, "con vencimiento mañana" reliably becomes
"Convencimiento mañana") plus that person's own category names. `melissa.js`
mirrors the same rule, so a voice note transcribes identically on both sides.
