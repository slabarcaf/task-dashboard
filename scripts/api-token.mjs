/**
 * Llaves personales de API (hoy: el conector de Meta Muse). Ver docs/MUSE.md.
 *
 *   node scripts/api-token.mjs mint   <email> [label] [scopes=tasks,debts]
 *   node scripts/api-token.mjs list   <email>
 *   node scripts/api-token.mjs revoke <email> <id>
 *
 * Un script local y no una ruta en la web a propósito: emitir llaves es algo que
 * pasa una vez, y cada ruta que lo permite es una puerta más que defender.
 * Lee DATABASE_URL de .env.local, como verify-sync.mjs.
 *
 * La llave se imprime UNA vez. La base solo guarda su SHA-256 — si se pierde,
 * se revoca y se emite otra.
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
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const [cmd, email, ...rest] = process.argv.slice(2);
const VALID_SCOPES = ["tasks", "debts"];

function usage() {
  console.error("uso: node scripts/api-token.mjs mint|list|revoke <email> …");
  process.exit(1);
}

async function main() {
  if (!cmd || !email) usage();

  // La misma DDL que db.ts: si la app todavía no arrancó con este código, la
  // tabla no existe aún.
  await pool.query(`
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

  const user = (await pool.query(`SELECT id, email FROM users WHERE lower(email) = lower($1)`, [email])).rows[0];
  if (!user) throw new Error(`no hay cuenta para ${email}`);

  if (cmd === "mint") {
    const label = rest[0] || "Meta Muse";
    const scopes = (rest[1] || "tasks,debts").split(",").map((s) => s.trim()).filter(Boolean);
    const bad = scopes.filter((s) => !VALID_SCOPES.includes(s));
    if (bad.length || scopes.length === 0) throw new Error(`alcances inválidos: ${bad.join(",") || "(ninguno)"}`);

    const token = "syd_" + crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const { rows } = await pool.query(
      `INSERT INTO api_tokens (user_id, token_hash, label, scopes) VALUES ($1, $2, $3, $4::text[]) RETURNING id`,
      [user.id, hash, label, scopes]
    );
    console.log(`Llave #${rows[0].id} para ${user.email} · "${label}" · alcances: ${scopes.join(", ")}`);
    console.log("Se muestra UNA sola vez:\n");
    console.log(token);
  } else if (cmd === "list") {
    const { rows } = await pool.query(
      `SELECT id, label, scopes, created_at, last_used_at, revoked_at
       FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    );
    if (!rows.length) console.log("(sin llaves)");
    for (const r of rows) {
      const state = r.revoked_at ? `revocada ${r.revoked_at.toISOString()}` : "activa";
      const used = r.last_used_at ? r.last_used_at.toISOString() : "nunca";
      console.log(`#${r.id}  ${r.label}  [${r.scopes.join(",")}]  ${state}  · último uso: ${used}`);
    }
  } else if (cmd === "revoke") {
    const id = Number(rest[0]);
    if (!Number.isInteger(id)) usage();
    const res = await pool.query(
      `UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [id, user.id]
    );
    console.log(res.rowCount ? `Llave #${id} revocada.` : `No había llave activa #${id} para ${user.email}.`);
  } else {
    usage();
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
