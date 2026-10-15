/**
 * Comprueba la puerta de Muse (`/api/muse/*`) de punta a punta.
 *
 *   node scripts/verify-muse.mjs                         # contra producción
 *   BASE=http://localhost:3000 node scripts/verify-muse.mjs
 *
 * Como verify-sync.mjs: todo lo que escribe va a dos cuentas desechables que
 * crea y borra; las cuentas reales no se tocan. Lo que prueba:
 *   - una llave válida lee y escribe solo lo suyo (la tarea de la otra cuenta da 404)
 *   - una llave sin alcance `debts` recibe 403 en /debts y un brief sin deudas
 *   - no hay DELETE
 *   - estados inventados y patches vacíos se rechazan
 *   - una llave revocada recibe 401
 *   - el bearer del bot no abre esta puerta
 */
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
const BASE = process.env.BASE || "https://task-dashboard-c7q2.vercel.app";
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const q = (s, p) => pool.query(s, p);

const EMAIL_A = "muse-selftest-a@example.invalid";
const EMAIL_B = "muse-selftest-b@example.invalid";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

async function mint(userId, scopes) {
  const token = "syd_" + crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { rows } = await q(
    `INSERT INTO api_tokens (user_id, token_hash, label, scopes) VALUES ($1,$2,'selftest',$3::text[]) RETURNING id`,
    [userId, hash, scopes]
  );
  return { token, id: rows[0].id };
}

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function cleanup() {
  // tasks.user_id es ON DELETE SET NULL: hay que borrarlas a mano o quedan huérfanas.
  await q(`DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))`, [[EMAIL_A, EMAIL_B]]);
  await q(`DELETE FROM users WHERE email = ANY($1)`, [[EMAIL_A, EMAIL_B]]);
}

async function main() {
  // La misma DDL que db.ts. Una petición sin llave da 401 antes de tocar la
  // base, así que no se puede contar con que la app ya la haya creado.
  await q(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL DEFAULT '',
      scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ
    )
  `);
  const before = (await q(`SELECT (SELECT count(*) FROM tasks) t, (SELECT count(*) FROM debts) d`)).rows[0];

  await cleanup();
  const a = (await q(`INSERT INTO users (email, name) VALUES ($1,'Muse A') RETURNING id`, [EMAIL_A])).rows[0].id;
  const b = (await q(`INSERT INTO users (email, name) VALUES ($1,'Muse B') RETURNING id`, [EMAIL_B])).rows[0].id;
  const foreign = (
    await q(
      `INSERT INTO tasks (user_id,to_do,status_final_outcome,tipo,due_date_next_step) VALUES ($1,'ajena','To-do','Otros',CURRENT_DATE) RETURNING id`,
      [b]
    )
  ).rows[0].id;

  try {
    const full = await mint(a, ["tasks", "debts"]);
    const tasksOnly = await mint(a, ["tasks"]);

    let r = await call(full.token, "GET", "/api/muse/tasks");
    check("GET tasks con llave válida", r.status === 200 && r.json.count === 0, JSON.stringify(r));

    r = await call(full.token, "POST", "/api/muse/tasks", {
      toDo: "Probar Muse",
      dueDateNextStep: "2026-01-01",
      recurrenceInterval: 1,
      recurrenceUnit: "week"
    });
    const id = r.json?.task?.rowId;
    check("POST task devuelve la fila escrita", r.status === 200 && r.json.task.toDo === "Probar Muse", JSON.stringify(r));

    r = await call(full.token, "POST", "/api/muse/tasks", { toDo: "x", dueDateNextStep: "2026-01-01", statusFinalOutcome: "Completed" });
    check("estado inventado → 400", r.status === 400, JSON.stringify(r));

    r = await call(full.token, "PATCH", `/api/muse/tasks/${id}`, {});
    check("patch vacío → 400", r.status === 400, JSON.stringify(r));

    r = await call(full.token, "PATCH", `/api/muse/tasks/${id}`, { statusFinalOutcome: "Done" });
    check(
      "PATCH Done devuelve Done y crea la siguiente recurrencia",
      r.status === 200 && r.json.task.statusFinalOutcome === "Done" && Number.isInteger(r.json.nextOccurrenceId),
      JSON.stringify(r)
    );

    r = await call(full.token, "PATCH", `/api/muse/tasks/${foreign}`, { statusFinalOutcome: "Done" });
    check("tarea de otra cuenta → 404", r.status === 404, JSON.stringify(r));
    const untouched = (await q(`SELECT status_final_outcome s FROM tasks WHERE id=$1`, [foreign])).rows[0].s;
    check("…y la tarea ajena sigue igual", untouched === "To-do", untouched);

    r = await call(full.token, "DELETE", `/api/muse/tasks/${id}`);
    check("no hay DELETE", r.status === 405, String(r.status));

    r = await call(full.token, "POST", "/api/muse/debts", { name: "Ana", amount: 12.5, direction: "Me deben" });
    const debtId = r.json?.debt?.id;
    check("POST debt", r.status === 200 && r.json.debt.direction === "Me deben", JSON.stringify(r));

    r = await call(full.token, "POST", "/api/muse/debts", { name: "Ana", amount: 5, direction: "owes me" });
    check("dirección ambigua → 400", r.status === 400, JSON.stringify(r));

    r = await call(full.token, "PATCH", `/api/muse/debts/${debtId}`, { status: "paid" });
    check("estado de deuda inventado → 400", r.status === 400, JSON.stringify(r));

    r = await call(full.token, "PATCH", `/api/muse/debts/${debtId}`, { status: "Pagado" });
    check("PATCH debt Pagado", r.status === 200 && r.json.debt.status === "Pagado", JSON.stringify(r));

    r = await call(full.token, "GET", "/api/muse/brief");
    check(
      "brief con llave completa",
      r.status === 200 && typeof r.json.today === "string" && r.json.counts.open === 1,
      JSON.stringify(r)
    );

    r = await call(tasksOnly.token, "GET", "/api/muse/debts");
    check("llave sin alcance debts → 403", r.status === 403, JSON.stringify(r));
    await call(full.token, "POST", "/api/muse/debts", { name: "Beto", amount: 3, direction: "Debo yo" });
    r = await call(tasksOnly.token, "GET", "/api/muse/brief");
    check("…y su brief no trae deudas", r.status === 200 && r.json.counts.pendingDebts === 0, JSON.stringify(r));

    if (env.OPENCLAW_API_SECRET) {
      r = await call(env.OPENCLAW_API_SECRET, "GET", "/api/muse/tasks");
      check("el bearer del bot no abre /api/muse", r.status === 401, String(r.status));
    }

    await q(`UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1`, [full.id]);
    r = await call(full.token, "GET", "/api/muse/tasks");
    check("llave revocada → 401", r.status === 401, String(r.status));

    r = await call("syd_" + "x".repeat(43), "GET", "/api/muse/tasks");
    check("llave inventada → 401", r.status === 401, String(r.status));
  } finally {
    await cleanup();
    const after = (await q(`SELECT (SELECT count(*) FROM tasks) t, (SELECT count(*) FROM debts) d`)).rows[0];
    check("la base quedó como estaba", after.t === before.t && after.d === before.d, JSON.stringify({ before, after }));
    await pool.end();
  }

  console.log(failures ? `\n${failures} fallaron` : "\nTodo bien.");
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
