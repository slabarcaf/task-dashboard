import crypto from "node:crypto";
import { Pool } from "pg";

type TaskRow = {
  id: number;
  to_do: string;
  status_final_outcome: string;
  tipo: string;
  next_step: string;
  due_date_next_step: string;
  status_next_step: string;
  recurrence_interval: number | null;
  recurrence_unit: "day" | "week" | "month" | null;
  is_priority: boolean | null;
};

type UserRow = {
  id: number;
  email: string;
  name: string;
  telegram_chat_id?: string | null;
};

type UserPreferencesRow = {
  onboarding_completed: boolean;
  tipo_options: string[] | null;
  language: string | null;
  timezone: string | null;
  brief_morning: string | null;
  brief_evening: string | null;
  category_keywords: Record<string, unknown> | null;
};

export type DbTask = {
  rowId: number;
  toDo: string;
  statusFinalOutcome: string;
  tipo: string;
  nextStep: string;
  dueDateNextStep: string;
  statusNextStep: string;
  recurrenceInterval: number | null;
  recurrenceUnit: "day" | "week" | "month" | null;
  isPriority: boolean;
};

export type DbUser = {
  id: number;
  email: string;
  name: string;
  /** Null when unlinked, undefined when the query did not select it. */
  telegramChatId?: string | null;
};

export type DbUserPreferences = {
  onboardingCompleted: boolean;
  tipoOptions: string[];
  language: string;
  timezone: string;
  briefMorning: string;
  briefEvening: string;
  /** Category name -> the words that hint at it. Only the bot reads these. */
  categoryKeywords: Record<string, string[]>;
};

// The canonical set is not duplicated here any more. It lives in
// src/lib/categories.ts (CANONICAL_CATEGORIES) and the onboarding screen offers
// it as *suggestions*; nothing on the server assigns categories to anybody.
// Keeping a second copy here is what leaked "University" and "Job" into a
// database that is otherwise Spanish — do not reintroduce one.

declare global {
  // eslint-disable-next-line no-var
  var __taskDashboardPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __taskDashboardInitPromise: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!global.__taskDashboardPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL");
    }

    global.__taskDashboardPgPool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined
    });
  }

  return global.__taskDashboardPgPool;
}

function toTask(row: TaskRow): DbTask {
  return {
    rowId: Number(row.id),
    toDo: row.to_do,
    statusFinalOutcome: row.status_final_outcome,
    tipo: row.tipo,
    nextStep: row.next_step,
    dueDateNextStep: row.due_date_next_step,
    statusNextStep: row.status_next_step,
    recurrenceInterval: row.recurrence_interval === null ? null : Number(row.recurrence_interval),
    recurrenceUnit: row.recurrence_unit,
    isPriority: row.is_priority === true
  };
}

function toUser(row: UserRow): DbUser {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    // Undefined when the query did not ask for it, which is why it is optional
    // on DbUser: only the callers that select it can report on it.
    telegramChatId: row.telegram_chat_id ?? null
  };
}

function normalizeTipoOptions(options: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of options) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

async function getDistinctTaskTiposByUser(userId: number): Promise<string[]> {
  const result = await getPool().query<{ tipo: string }>(
    `SELECT DISTINCT tipo
     FROM tasks
     WHERE user_id = $1
       AND NULLIF(BTRIM(tipo), '') IS NOT NULL
     ORDER BY tipo ASC`,
    [userId]
  );
  return normalizeTipoOptions(result.rows.map((row) => row.tipo));
}

async function ensureOwnerUserAndBackfill(pool: Pool): Promise<void> {
  const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu")
    .trim()
    .toLowerCase();
  const ownerName = (process.env.DEFAULT_OWNER_NAME || "Santiago Labarca").trim();

  if (!ownerEmail) return;

  const ownerQuery = await pool.query<UserRow>(
    `INSERT INTO users (email, name)
     VALUES ($1, $2)
     ON CONFLICT (email)
     DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name), updated_at = NOW()
     RETURNING id, email, name, telegram_chat_id`,
    [ownerEmail, ownerName]
  );

  const owner = ownerQuery.rows[0];
  if (!owner) return;

  await pool.query(`UPDATE tasks SET user_id = $1 WHERE user_id IS NULL`, [owner.id]);
}

async function initialize(): Promise<void> {
  if (!global.__taskDashboardInitPromise) {
    global.__taskDashboardInitPromise = (async () => {
      const pool = getPool();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          google_sub TEXT UNIQUE,
          onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
          tipo_options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE`
      );
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS tipo_options TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`
      );
      // Lets the Sydney bot address a specific person instead of resolving every
      // Telegram chat to the one owner account. Nullable: browser-only users
      // never get one.
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT`
      );
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_chat_id
         ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL`
      );

      // Preferences that used to live only in the bot's SQLite on the VM. Two
      // stores for one fact is how they end up disagreeing: Santiago's category
      // list was empty in SQLite and eight entries long here. Postgres is the
      // source of truth now; the bot reads these over the API.
      //
      // Every column has a NOT NULL default matching the bot's old default, so
      // rows that predate the migration answer the same thing they always did.
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'`);
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'`
      );
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS brief_morning TEXT NOT NULL DEFAULT '07:00'`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS brief_evening TEXT NOT NULL DEFAULT '20:00'`);
      // name -> keywords. `tipo_options` stays the one list of categories; this
      // only carries the hints the bot feeds the model when it classifies a
      // task, which is why it is a side table rather than a richer category
      // type: the web never needs to know keywords exist.
      await pool.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS category_keywords JSONB NOT NULL DEFAULT '{}'::jsonb`
      );

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id BIGSERIAL PRIMARY KEY,
          token TEXT NOT NULL UNIQUE,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
          to_do TEXT NOT NULL,
          status_final_outcome TEXT NOT NULL,
          tipo TEXT NOT NULL,
          next_step TEXT NOT NULL DEFAULT '',
          due_date_next_step DATE NOT NULL,
          status_next_step TEXT NOT NULL DEFAULT '',
          recurrence_interval INTEGER,
          recurrence_unit TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(
        `ALTER TABLE tasks
         ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER`
      );
      await pool.query(
        `ALTER TABLE tasks
         ADD COLUMN IF NOT EXISTS recurrence_unit TEXT`
      );
      // Priority used to live only in priority.json on the bot's VM, keyed by
      // row id, so the web UI could not see or set the 🔴 flag at all.
      await pool.query(
        `ALTER TABLE tasks
         ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT FALSE`
      );

      // Short-lived codes that connect a web account to a Telegram chat. The web
      // mints one for the signed-in user; the bot redeems it when that person
      // sends /link CODE. Single use; see LINK_CODE_TTL_MINUTES for the window.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_link_codes (
          code TEXT PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          used_by_chat_id TEXT
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_link_codes_user ON telegram_link_codes(user_id)`);

      // Debts lived only in the bot's SQLite, so the web could not show them at
      // all — the same split that made preferences disagree with themselves.
      //
      // ON DELETE CASCADE, unlike tasks' SET NULL: a debt belongs to the person
      // who recorded it and means nothing without them. Tasks kept SET NULL for
      // a historical reason that has since bitten us; there is no reason to
      // repeat it here.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS debts (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          amount NUMERIC(14,2) NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          direction TEXT NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'Por pagar',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status_changed_at TIMESTAMPTZ
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id)`);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);

      await ensureOwnerUserAndBackfill(pool);
    })();
  }

  await global.__taskDashboardInitPromise;
}

export async function initDb(): Promise<void> {
  await initialize();
}

export async function listDbTasksByUser(userId: number): Promise<DbTask[]> {
  await initialize();

  const result = await getPool().query<TaskRow>(
    `SELECT id, to_do, status_final_outcome, tipo, next_step,
            to_char(due_date_next_step, 'YYYY-MM-DD') AS due_date_next_step,
            status_next_step, recurrence_interval, recurrence_unit, is_priority
     FROM tasks
     WHERE user_id = $1
     ORDER BY due_date_next_step ASC, id ASC`,
    [userId]
  );

  return result.rows.map(toTask);
}

export async function createDbTaskForUser(
  userId: number,
  input: Omit<DbTask, "rowId" | "isPriority"> & { isPriority?: boolean }
): Promise<number> {
  await initialize();

  const result = await getPool().query<{ id: number }>(
    `INSERT INTO tasks (user_id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, recurrence_interval, recurrence_unit, is_priority, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, NOW())
     RETURNING id`,
    [
      userId,
      input.toDo,
      input.statusFinalOutcome,
      input.tipo,
      input.nextStep,
      input.dueDateNextStep,
      input.statusNextStep,
      input.recurrenceInterval,
      input.recurrenceUnit,
      input.isPriority === true
    ]
  );

  return Number(result.rows[0].id);
}

export async function getDbTaskByIdForUser(id: number, userId: number): Promise<DbTask | null> {
  await initialize();

  const result = await getPool().query<TaskRow>(
    `SELECT id, to_do, status_final_outcome, tipo, next_step,
            to_char(due_date_next_step, 'YYYY-MM-DD') AS due_date_next_step,
            status_next_step, recurrence_interval, recurrence_unit, is_priority
     FROM tasks
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (result.rowCount === 0) return null;
  return toTask(result.rows[0]);
}

export async function updateDbTaskForUser(
  id: number,
  userId: number,
  patch: Partial<Omit<DbTask, "rowId">>
): Promise<boolean> {
  const existing = await getDbTaskByIdForUser(id, userId);
  if (!existing) return false;

  const next: Omit<DbTask, "rowId"> = {
    toDo: patch.toDo ?? existing.toDo,
    statusFinalOutcome: patch.statusFinalOutcome ?? existing.statusFinalOutcome,
    tipo: patch.tipo ?? existing.tipo,
    nextStep: patch.nextStep ?? existing.nextStep,
    dueDateNextStep: patch.dueDateNextStep ?? existing.dueDateNextStep,
    statusNextStep: patch.statusNextStep ?? existing.statusNextStep,
    recurrenceInterval: patch.recurrenceInterval ?? existing.recurrenceInterval,
    recurrenceUnit: patch.recurrenceUnit ?? existing.recurrenceUnit,
    isPriority: patch.isPriority ?? existing.isPriority
  };

  await initialize();
  const result = await getPool().query(
    `UPDATE tasks
     SET to_do = $1,
         status_final_outcome = $2,
         tipo = $3,
         next_step = $4,
         due_date_next_step = $5::date,
         status_next_step = $6,
         recurrence_interval = $7,
         recurrence_unit = $8,
         is_priority = $9,
         updated_at = NOW()
     WHERE id = $10 AND user_id = $11`,
    [
      next.toDo,
      next.statusFinalOutcome,
      next.tipo,
      next.nextStep,
      next.dueDateNextStep,
      next.statusNextStep,
      next.recurrenceInterval,
      next.recurrenceUnit,
      next.isPriority === true,
      id,
      userId
    ]
  );

  return (result.rowCount || 0) > 0;
}

export async function deleteDbTaskForUser(id: number, userId: number): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount || 0) > 0;
}

export async function replaceAllDbTasksForUser(
  userId: number,
  tasks: Array<Omit<DbTask, "rowId">>
): Promise<void> {
  await initialize();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM tasks WHERE user_id = $1`, [userId]);

    for (const task of tasks) {
      await client.query(
        `INSERT INTO tasks (user_id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, recurrence_interval, recurrence_unit, is_priority, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, NOW())`,
        [
          userId,
          task.toDo,
          task.statusFinalOutcome,
          task.tipo,
          task.nextStep,
          task.dueDateNextStep,
          task.statusNextStep,
          task.recurrenceInterval,
          task.recurrenceUnit,
          task.isPriority === true
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ── Connecting a web account to Telegram ─────────────────────────────────────
// Ambiguous characters (0/O, 1/I/L) are left out so a code can be read aloud or
// retyped from a phone without confusion. Same alphabet the bot uses for invites.
const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// 24 hours, not minutes. Someone who does not have Telegram yet has to install
// it, create an account and verify a phone number before they can redeem — a
// 15-minute window guaranteed they would come back to a dead code. The code is
// single use, revoked the moment a new one is minted, and only ever grants
// linking to an account the person already authenticated into, so a long window
// costs little.
const LINK_CODE_TTL_MINUTES = 60 * 24;

export async function createTelegramLinkCode(userId: number): Promise<{ code: string; expiresAt: Date }> {
  await initialize();
  const pool = getPool();

  // One live code per person: minting a new one retires the old, so a code read
  // off a stale browser tab cannot still work.
  await pool.query(`DELETE FROM telegram_link_codes WHERE user_id = $1 AND used_at IS NULL`, [userId]);

  let code = "";
  for (let i = 0; i < 8; i++) code += LINK_CODE_ALPHABET[crypto.randomInt(LINK_CODE_ALPHABET.length)];
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000);

  await pool.query(
    `INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES ($1, $2, $3)`,
    [code, userId, expiresAt]
  );
  return { code, expiresAt };
}

export type LinkResult =
  | { ok: true; user: DbUser }
  | { ok: false; reason: "not_found" | "expired" | "used" | "chat_taken" };

export async function redeemTelegramLinkCode(code: string, chatId: string): Promise<LinkResult> {
  await initialize();
  const pool = getPool();
  const normalized = String(code || "").trim().toUpperCase();
  const chat = String(chatId || "").trim();

  const found = await pool.query<{ user_id: number; expires_at: Date; used_at: Date | null }>(
    `SELECT user_id, expires_at, used_at FROM telegram_link_codes WHERE code = $1`,
    [normalized]
  );
  if (found.rowCount === 0) return { ok: false, reason: "not_found" };

  const row = found.rows[0];
  if (row.used_at) return { ok: false, reason: "used" };
  if (new Date(row.expires_at) < new Date()) return { ok: false, reason: "expired" };

  // A chat may only ever point at one person. Without this, redeeming someone
  // else's code from an already-linked phone would silently move that chat's
  // tasks to a different account.
  const taken = await pool.query<{ id: number }>(
    `SELECT id FROM users WHERE telegram_chat_id = $1 AND id <> $2`,
    [chat, row.user_id]
  );
  if ((taken.rowCount || 0) > 0) return { ok: false, reason: "chat_taken" };

  const updated = await pool.query<UserRow>(
    `UPDATE users SET telegram_chat_id = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, email, name, telegram_chat_id`,
    [chat, row.user_id]
  );
  await pool.query(
    `UPDATE telegram_link_codes SET used_at = NOW(), used_by_chat_id = $1 WHERE code = $2`,
    [chat, normalized]
  );

  return { ok: true, user: toUser(updated.rows[0]) };
}

export async function findUserByTelegramChatId(chatId: string): Promise<DbUser | null> {
  await initialize();

  const result = await getPool().query<UserRow>(
    `SELECT id, email, name, telegram_chat_id
     FROM users
     WHERE telegram_chat_id = $1
     LIMIT 1`,
    [String(chatId).trim()]
  );

  if (result.rowCount === 0) return null;
  return toUser(result.rows[0]);
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  await initialize();

  const result = await getPool().query<UserRow>(
    `SELECT id, email, name, telegram_chat_id
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()]
  );

  if (result.rowCount === 0) return null;
  return toUser(result.rows[0]);
}

export async function getUserById(id: number): Promise<DbUser | null> {
  await initialize();

  const result = await getPool().query<UserRow>(
    `SELECT id, email, name, telegram_chat_id
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (result.rowCount === 0) return null;
  return toUser(result.rows[0]);
}

export async function getUserPreferencesByUserId(userId: number): Promise<DbUserPreferences> {
  await initialize();

  const result = await getPool().query<UserPreferencesRow>(
    `SELECT onboarding_completed, tipo_options, language, timezone,
            brief_morning, brief_evening, category_keywords
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  const row = result.rows[0];
  let tipoOptions = normalizeTipoOptions(row.tipo_options || []);
  let onboardingCompleted = Boolean(row.onboarding_completed);

  // Repair a list that was lost while tasks survived: the categories those
  // tasks carry are, by definition, the ones this person uses.
  //
  // ⚠️ It deliberately stops there. This used to fall through to
  // DEFAULT_USER_TIPO_OPTIONS when the user had no tasks either — which meant a
  // brand-new account was handed all eight canonical categories, written to the
  // database, and then shown an onboarding screen asking "choose the ones you
  // actually use" with every one of them already ticked. The likeliest action is
  // to press Continue, and that is how somebody ends up owning five categories
  // they never use. A read should not invent a preference and persist it.
  if (tipoOptions.length === 0) {
    tipoOptions = await getDistinctTaskTiposByUser(userId);
  }

  if (!onboardingCompleted) {
    const existingTaskTipos = await getDistinctTaskTiposByUser(userId);
    if (existingTaskTipos.length > 0) {
      onboardingCompleted = true;
      if (tipoOptions.length === 0) {
        tipoOptions = existingTaskTipos;
      }
    }
  }

  await getPool().query(
    `UPDATE users
     SET onboarding_completed = $1,
         tipo_options = $2::text[],
         updated_at = NOW()
     WHERE id = $3`,
    [onboardingCompleted, tipoOptions, userId]
  );

  return {
    onboardingCompleted,
    tipoOptions,
    ...readPreferenceScalars(row)
  };
}

/** The columns that need no repair, shaped for the API. */
function readPreferenceScalars(row: UserPreferencesRow) {
  return {
    language: row.language || "es",
    timezone: row.timezone || "America/Los_Angeles",
    // `??`, not `||`. The empty string is a real value here — it is how a brief
    // is turned off — and `||` coerced it straight back to the default, so the
    // column stored "" while the API kept answering "20:00" and the brief kept
    // firing. Stored correctly, read back wrong, is the worst of both.
    briefMorning: row.brief_morning ?? "07:00",
    briefEvening: row.brief_evening ?? "20:00",
    categoryKeywords: normalizeCategoryKeywords(row.category_keywords)
  };
}

/**
 * Coerces whatever is in the jsonb column into `name -> string[]`.
 *
 * It is written by the bot, which builds it from a JSON blob a user's onboarding
 * produced, so it is not worth trusting its shape. A malformed entry is dropped
 * rather than allowed to reach the prompt builder as, say, a number.
 */
function normalizeCategoryKeywords(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: Record<string, string[]> = {};
  for (const [name, words] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(name || "").trim();
    if (!key) continue;
    if (!Array.isArray(words)) continue;
    const list = words.map((word) => String(word || "").trim()).filter(Boolean);
    if (list.length > 0) output[key] = list;
  }
  return output;
}

export type PreferencePatch = {
  tipoOptions?: string[];
  language?: string;
  timezone?: string;
  briefMorning?: string;
  briefEvening?: string;
  categoryKeywords?: Record<string, string[]>;
};

/**
 * Writes only the preferences that were actually sent.
 *
 * `COALESCE($n, column)` rather than a full row update: the web knows about
 * categories and the bot knows about brief times, and neither should blank the
 * other's fields just by saving its own. A partial writer that overwrites what
 * it does not know is how one surface silently resets another's settings.
 */
export async function saveUserPreferencesByUserId(
  userId: number,
  patch: PreferencePatch
): Promise<DbUserPreferences> {
  await initialize();

  let normalized: string[] | null = null;
  if (patch.tipoOptions !== undefined) {
    normalized = normalizeTipoOptions(patch.tipoOptions);
    if (normalized.length === 0) {
      throw new Error("At least one task type is required");
    }
  }

  const result = await getPool().query<UserPreferencesRow>(
    `UPDATE users
     SET onboarding_completed = onboarding_completed OR $1::boolean,
         tipo_options       = COALESCE($2::text[], tipo_options),
         language           = COALESCE($3::text, language),
         timezone           = COALESCE($4::text, timezone),
         brief_morning      = COALESCE($5::text, brief_morning),
         brief_evening      = COALESCE($6::text, brief_evening),
         category_keywords  = COALESCE($7::jsonb, category_keywords),
         updated_at = NOW()
     WHERE id = $8
     RETURNING onboarding_completed, tipo_options, language, timezone,
               brief_morning, brief_evening, category_keywords`,
    [
      normalized !== null,
      normalized,
      patch.language ?? null,
      patch.timezone ?? null,
      patch.briefMorning ?? null,
      patch.briefEvening ?? null,
      patch.categoryKeywords ? JSON.stringify(patch.categoryKeywords) : null,
      userId
    ]
  );

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  const row = result.rows[0];
  return {
    onboardingCompleted: Boolean(row.onboarding_completed),
    tipoOptions: normalizeTipoOptions(row.tipo_options || []),
    ...readPreferenceScalars(row)
  };
}

/**
 * "7:00" and "07:00" are the same time; "25:00" is not a time at all.
 *
 * The empty string is a real value here, not a missing one: it is how a person
 * turns a brief off. Returns null for anything that is not a time, which the
 * route turns into a 400 rather than a silent no-op — a brief that quietly kept
 * its old hour after you asked to change it is worse than an error.
 */
export function normalizeTimeOfDay(value: string): string | null {
  const raw = String(value).trim();
  if (raw === "") return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function createUser(input: {
  email: string;
  name?: string;
  googleSub?: string;
}): Promise<DbUser> {
  await initialize();

  const email = input.email.trim().toLowerCase();
  const name = (input.name || "").trim();
  const googleSub = input.googleSub?.trim() || null;

  const result = await getPool().query<UserRow>(
    `INSERT INTO users (email, name, google_sub, updated_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, email, name, telegram_chat_id`,
    [email, name, googleSub]
  );

  return toUser(result.rows[0]);
}

export async function upsertGoogleUser(input: {
  email: string;
  name?: string;
  googleSub: string;
}): Promise<DbUser> {
  await initialize();

  const email = input.email.trim().toLowerCase();
  const name = (input.name || "").trim();
  const googleSub = input.googleSub.trim();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const byGoogleSub = await client.query<UserRow>(
      `SELECT id, email, name, telegram_chat_id
       FROM users
       WHERE google_sub = $1
       LIMIT 1`,
      [googleSub]
    );

    if (byGoogleSub.rowCount) {
      const updated = await client.query<UserRow>(
        `UPDATE users
         SET email = $1,
             name = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, email, name, telegram_chat_id`,
        [email, name, byGoogleSub.rows[0].id]
      );
      await client.query("COMMIT");
      return toUser(updated.rows[0]);
    }

    const byEmail = await client.query<UserRow>(
      `SELECT id, email, name, telegram_chat_id
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );

    if (byEmail.rowCount) {
      const existing = byEmail.rows[0];
      const updated = await client.query<UserRow>(
        `UPDATE users
         SET google_sub = $1,
             name = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, email, name, telegram_chat_id`,
        [googleSub, name || existing.name, existing.id]
      );
      await client.query("COMMIT");
      return toUser(updated.rows[0]);
    }

    const created = await client.query<UserRow>(
      `INSERT INTO users (email, name, google_sub, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, name, telegram_chat_id`,
      [email, name, googleSub]
    );

    await client.query("COMMIT");
    return toUser(created.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSession(userId: number, expiresAt: Date): Promise<string> {
  await initialize();

  const token = crypto.randomBytes(32).toString("hex");
  await getPool().query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, $3::timestamptz)`,
    [token, userId, expiresAt.toISOString()]
  );
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await initialize();
  await getPool().query(`DELETE FROM sessions WHERE token = $1`, [token]);
}

export async function getUserBySessionToken(token: string): Promise<DbUser | null> {
  await initialize();

  const result = await getPool().query<UserRow>(
    `SELECT u.id, u.email, u.name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1
       AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (result.rowCount === 0) return null;
  return toUser(result.rows[0]);
}

export async function deleteExpiredSessions(): Promise<void> {
  await initialize();
  await getPool().query(`DELETE FROM sessions WHERE expires_at <= NOW()`);
}

/* ─── Admin overview ──────────────────────────────────────────────────────
   Everything the admin screen shows comes from one query. Counting tasks per
   user in a subquery rather than a join keeps each user on exactly one row even
   when they have none. */

export type AdminUserOverview = {
  id: number;
  email: string;
  name: string;
  createdAt: string;
  onboardingCompleted: boolean;
  categoryCount: number;
  telegramLinked: boolean;
  /** Only the last four digits of the chat id: enough to tell chats apart. */
  telegramChatIdTail: string | null;
  taskCount: number;
  pendingCount: number;
  overdueCount: number;
  priorityCount: number;
  lastTaskActivityAt: string | null;
  lastSignInAt: string | null;
};

export async function listAdminUserOverview(): Promise<AdminUserOverview[]> {
  await initialize();
  const pool = getPool();
  const result = await pool.query(
    `SELECT
       u.id,
       u.email,
       u.name,
       u.created_at,
       u.onboarding_completed,
       COALESCE(array_length(u.tipo_options, 1), 0) AS category_count,
       u.telegram_chat_id,
       (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id) AS task_count,
       (SELECT COUNT(*) FROM tasks t
         WHERE t.user_id = u.id AND t.status_final_outcome <> 'Done') AS pending_count,
       (SELECT COUNT(*) FROM tasks t
         WHERE t.user_id = u.id AND t.status_final_outcome <> 'Done'
           AND t.due_date_next_step < CURRENT_DATE) AS overdue_count,
       (SELECT COUNT(*) FROM tasks t
         WHERE t.user_id = u.id AND t.status_final_outcome <> 'Done'
           AND t.is_priority) AS priority_count,
       (SELECT MAX(t.updated_at) FROM tasks t WHERE t.user_id = u.id) AS last_task_activity_at,
       (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_sign_in_at
     FROM users u
     ORDER BY u.created_at ASC, u.id ASC`
  );

  return result.rows.map((row) => {
    const chatId = row.telegram_chat_id ? String(row.telegram_chat_id) : null;
    return {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name || ""),
      createdAt: new Date(row.created_at).toISOString(),
      onboardingCompleted: Boolean(row.onboarding_completed),
      categoryCount: Number(row.category_count || 0),
      telegramLinked: Boolean(chatId),
      telegramChatIdTail: chatId ? chatId.slice(-4) : null,
      taskCount: Number(row.task_count || 0),
      pendingCount: Number(row.pending_count || 0),
      overdueCount: Number(row.overdue_count || 0),
      priorityCount: Number(row.priority_count || 0),
      lastTaskActivityAt: row.last_task_activity_at
        ? new Date(row.last_task_activity_at).toISOString()
        : null,
      lastSignInAt: row.last_sign_in_at ? new Date(row.last_sign_in_at).toISOString() : null
    };
  });
}

/** Sends the user back through onboarding the next time they open the app. */
export async function resetUserOnboarding(userId: number): Promise<boolean> {
  await initialize();
  const result = await getPool().query(
    `UPDATE users SET onboarding_completed = FALSE, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  return (result.rowCount || 0) > 0;
}

/**
 * Forgets which Telegram chat belongs to this account.
 *
 * The person keeps their account and their tasks; the bot simply stops
 * recognising them until they run /link again. Unused link codes go too, so a
 * code minted before the disconnect cannot silently reconnect the old chat.
 */
export async function unlinkTelegramForUser(userId: number): Promise<boolean> {
  await initialize();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE users SET telegram_chat_id = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    await client.query(`DELETE FROM telegram_link_codes WHERE user_id = $1 AND used_at IS NULL`, [
      userId
    ]);
    await client.query("COMMIT");
    return (result.rowCount || 0) > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Deletes an account and everything in it.
 *
 * ⚠️ The tasks go first, and that order is the whole point. `tasks.user_id` is
 * `ON DELETE SET NULL`, so deleting the user row on its own would leave their
 * tasks ownerless — and `ensureOwnerUserAndBackfill` sweeps every ownerless task
 * into the owner's account on the next boot. A "deleted" user's tasks would
 * quietly reappear in Santiago's list. That is not hypothetical; it is why the
 * September cleanup deleted tasks first and aborted on any ownerless row.
 *
 * Sessions and link codes are ON DELETE CASCADE, so they need no help.
 */
export async function deleteUserAndTheirTasks(
  userId: number
): Promise<{ deleted: boolean; taskCount: number }> {
  await initialize();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tasks = await client.query(`DELETE FROM tasks WHERE user_id = $1`, [userId]);
    const user = await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query("COMMIT");
    return { deleted: (user.rowCount || 0) > 0, taskCount: tasks.rowCount || 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


/* ─── Deudas ──────────────────────────────────────────────────────────────
   "Debo yo" / "Me deben", con su estado. Vivían solo en la SQLite del bot, así
   que la web no podía mostrarlas. */

export type DbDebt = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  direction: "Debo yo" | "Me deben";
  reason: string;
  status: "Por pagar" | "Pagado";
  createdAt: string;
  statusChangedAt: string | null;
};

type DebtRow = {
  id: number;
  name: string;
  amount: string;
  currency: string;
  direction: string;
  reason: string;
  status: string;
  created_at: Date;
  status_changed_at: Date | null;
};

/** NUMERIC comes back from pg as a string; parsing it here keeps that off the UI. */
function toDebt(row: DebtRow): DbDebt {
  return {
    id: Number(row.id),
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency,
    direction: row.direction === "Debo yo" ? "Debo yo" : "Me deben",
    reason: row.reason || "",
    status: row.status === "Pagado" ? "Pagado" : "Por pagar",
    createdAt: new Date(row.created_at).toISOString(),
    statusChangedAt: row.status_changed_at ? new Date(row.status_changed_at).toISOString() : null
  };
}

/** The bot accepts free text for direction; this is the same normalisation. */
export function normalizeDebtDirection(direction: string): "Debo yo" | "Me deben" {
  const value = String(direction || "").toLowerCase();
  if (/(me deben|owes me|me debe|they owe)/.test(value)) return "Me deben";
  if (/(debo|i owe|owe)/.test(value)) return "Debo yo";
  return "Me deben";
}

export async function listDebtsByUser(userId: number): Promise<DbDebt[]> {
  await initialize();
  const result = await getPool().query<DebtRow>(
    `SELECT id, name, amount, currency, direction, reason, status, created_at, status_changed_at
     FROM debts WHERE user_id = $1 ORDER BY status = 'Pagado', created_at DESC, id DESC`,
    [userId]
  );
  return result.rows.map(toDebt);
}

export async function createDebtForUser(
  userId: number,
  input: { name: string; amount: number; currency?: string; direction: string; reason?: string }
): Promise<DbDebt> {
  await initialize();
  const result = await getPool().query<DebtRow>(
    `INSERT INTO debts (user_id, name, amount, currency, direction, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, amount, currency, direction, reason, status, created_at, status_changed_at`,
    [
      userId,
      input.name.trim(),
      input.amount,
      (input.currency || "USD").toUpperCase(),
      normalizeDebtDirection(input.direction),
      (input.reason || "").trim()
    ]
  );
  return toDebt(result.rows[0]);
}

/** Scoped by user_id in the WHERE, so one account can never touch another's. */
export async function updateDebtForUser(
  id: number,
  userId: number,
  status: "Por pagar" | "Pagado"
): Promise<DbDebt | null> {
  await initialize();
  const result = await getPool().query<DebtRow>(
    `UPDATE debts
     SET status = $1,
         status_changed_at = CASE WHEN $1 = 'Pagado' THEN NOW() ELSE NULL END
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, amount, currency, direction, reason, status, created_at, status_changed_at`,
    [status, id, userId]
  );
  return result.rowCount ? toDebt(result.rows[0]) : null;
}

export async function deleteDebtForUser(id: number, userId: number): Promise<boolean> {
  await initialize();
  const result = await getPool().query(`DELETE FROM debts WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (result.rowCount || 0) > 0;
}
