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
};

type UserRow = {
  id: number;
  email: string;
  name: string;
};

type UserPreferencesRow = {
  onboarding_completed: boolean;
  tipo_options: string[] | null;
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
};

export type DbUser = {
  id: number;
  email: string;
  name: string;
};

export type DbUserPreferences = {
  onboardingCompleted: boolean;
  tipoOptions: string[];
};

const DEFAULT_USER_TIPO_OPTIONS = [
  "Finances",
  "Others",
  "University",
  "Job",
  "Personal",
  "Household"
];

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
    recurrenceUnit: row.recurrence_unit
  };
}

function toUser(row: UserRow): DbUser {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name
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
     RETURNING id, email, name`,
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
            status_next_step, recurrence_interval, recurrence_unit
     FROM tasks
     WHERE user_id = $1
     ORDER BY due_date_next_step ASC, id ASC`,
    [userId]
  );

  return result.rows.map(toTask);
}

export async function createDbTaskForUser(
  userId: number,
  input: Omit<DbTask, "rowId">
): Promise<number> {
  await initialize();

  const result = await getPool().query<{ id: number }>(
    `INSERT INTO tasks (user_id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, recurrence_interval, recurrence_unit, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, NOW())
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
      input.recurrenceUnit
    ]
  );

  return Number(result.rows[0].id);
}

export async function getDbTaskByIdForUser(id: number, userId: number): Promise<DbTask | null> {
  await initialize();

  const result = await getPool().query<TaskRow>(
    `SELECT id, to_do, status_final_outcome, tipo, next_step,
            to_char(due_date_next_step, 'YYYY-MM-DD') AS due_date_next_step,
            status_next_step, recurrence_interval, recurrence_unit
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
    recurrenceUnit: patch.recurrenceUnit ?? existing.recurrenceUnit
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
         updated_at = NOW()
     WHERE id = $9 AND user_id = $10`,
    [
      next.toDo,
      next.statusFinalOutcome,
      next.tipo,
      next.nextStep,
      next.dueDateNextStep,
      next.statusNextStep,
      next.recurrenceInterval,
      next.recurrenceUnit,
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
        `INSERT INTO tasks (user_id, to_do, status_final_outcome, tipo, next_step, due_date_next_step, status_next_step, recurrence_interval, recurrence_unit, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, NOW())`,
        [
          userId,
          task.toDo,
          task.statusFinalOutcome,
          task.tipo,
          task.nextStep,
          task.dueDateNextStep,
          task.statusNextStep,
          task.recurrenceInterval,
          task.recurrenceUnit
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

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  await initialize();

  const result = await getPool().query<UserRow>(
    `SELECT id, email, name
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
    `SELECT id, email, name
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
    `SELECT onboarding_completed, tipo_options
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

  if (tipoOptions.length === 0) {
    tipoOptions = await getDistinctTaskTiposByUser(userId);
    if (tipoOptions.length === 0) {
      tipoOptions = [...DEFAULT_USER_TIPO_OPTIONS];
    }
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
    tipoOptions
  };
}

export async function saveUserPreferencesByUserId(
  userId: number,
  tipoOptions: string[]
): Promise<DbUserPreferences> {
  await initialize();
  const normalized = normalizeTipoOptions(tipoOptions);
  if (normalized.length === 0) {
    throw new Error("At least one task type is required");
  }

  const result = await getPool().query<UserPreferencesRow>(
    `UPDATE users
     SET onboarding_completed = TRUE,
         tipo_options = $1::text[],
         updated_at = NOW()
     WHERE id = $2
     RETURNING onboarding_completed, tipo_options`,
    [normalized, userId]
  );

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  return {
    onboardingCompleted: Boolean(result.rows[0].onboarding_completed),
    tipoOptions: normalizeTipoOptions(result.rows[0].tipo_options || [])
  };
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
     RETURNING id, email, name`,
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
      `SELECT id, email, name
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
         RETURNING id, email, name`,
        [email, name, byGoogleSub.rows[0].id]
      );
      await client.query("COMMIT");
      return toUser(updated.rows[0]);
    }

    const byEmail = await client.query<UserRow>(
      `SELECT id, email, name
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
         RETURNING id, email, name`,
        [googleSub, name || existing.name, existing.id]
      );
      await client.query("COMMIT");
      return toUser(updated.rows[0]);
    }

    const created = await client.query<UserRow>(
      `INSERT INTO users (email, name, google_sub, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, name`,
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
