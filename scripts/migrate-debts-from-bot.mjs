/**
 * One-time move of the bot's debts from SQLite into Postgres.
 * Ran on 2026-09-10; kept as the record of what it did.
 *
 *   ssh -i ~/.ssh/id_ed25519 opc@$VM_HOST 'sudo -u melissa node -e "
 *     const {DatabaseSync}=require(\'node:sqlite\');
 *     const db=new DatabaseSync(\'/opt/melissa/whatsapp-bot/melissa.db\');
 *     console.log(JSON.stringify(db.prepare(\'SELECT * FROM debts ORDER BY id\').all()));
 *   " 2>/dev/null' > /tmp/debts.json
 *
 *   node scripts/migrate-debts-from-bot.mjs              # ensayo
 *   node scripts/migrate-debts-from-bot.mjs apply /tmp/debts.json
 *
 * Idempotent by (user, name, amount, created_at): re-running does not duplicate.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv[2] === "apply";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const rows = JSON.parse(readFileSync(process.argv[3] || "/tmp/debts.json", "utf8"));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// The app creates this on boot; the script may well run before that happens.
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

let inserted = 0, skipped = 0, orphan = 0;
for (const r of rows) {
  const owner = await pool.query(`SELECT id, email FROM users WHERE telegram_chat_id = $1`, [String(r.user_id)]);
  if (owner.rowCount === 0) {
    console.log(`⚠️  deuda #${r.id} (${r.name}) — chat ${r.user_id} sin cuenta, se omite`);
    orphan++;
    continue;
  }
  const userId = owner.rows[0].id;
  const dup = await pool.query(
    `SELECT 1 FROM debts WHERE user_id=$1 AND name=$2 AND amount=$3 AND created_at::date=$4::date`,
    [userId, r.name, r.amount, r.created_at]
  );
  if (dup.rowCount) { skipped++; continue; }

  console.log(`  ${r.direction.padEnd(9)} ${String(r.amount).padStart(7)} ${r.currency}  ${r.name} — ${r.status}`);
  if (APPLY) {
    await pool.query(
      `INSERT INTO debts (user_id,name,amount,currency,direction,reason,status,created_at,status_changed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date)`,
      [userId, r.name, r.amount, r.currency || "USD", r.direction, r.reason || "",
       r.status || "Por pagar", r.created_at, r.status_changed_at]
    );
  }
  inserted++;
}

const total = (await pool.query(`SELECT COUNT(*)::int n FROM debts`)).rows[0].n;
console.log(`\n${APPLY ? "insertadas" : "se insertarían"}: ${inserted} | ya estaban: ${skipped} | sin cuenta: ${orphan}`);
console.log(`total en Postgres ahora: ${total}`);
await pool.end();
