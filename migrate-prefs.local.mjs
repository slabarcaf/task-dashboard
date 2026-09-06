/**
 * One-time move of the bot's per-user preferences from SQLite into Postgres.
 *
 * Run with no arguments for a dry run. Pass `apply` to write.
 *
 * The category rule is the only part that needs judgement. The three inputs
 * disagree, and the *stored* Postgres list is the one that turned out to be
 * junk for both users — the second user's held five English identifiers she never once used
 * on a task, and Santiago's was missing four he uses daily. So the list becomes:
 *
 *     what they chose in Telegram  ∪  what their tasks actually use
 *
 * and the old `tipo_options` is not an input at all. The script refuses to run
 * if that would drop a category that has even one task behind it.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv[2] === "apply";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const sqliteUsers = JSON.parse(readFileSync(process.argv[3] || "/private/tmp/claude-501/-Users-santiagolabarca-Documents/6d9fec21-93a0-405e-a872-23bed3d6e31c/scratchpad/sqlite-users.json", "utf8"));
// Santiago's own SQLite row has an empty category list: he predates per-user
// onboarding, so his bot prompt is still built from this shared file. It is
// therefore his effective choice, and the keywords source for his categories.
const shared = JSON.parse(readFileSync("/Users/santiagolabarca/Documents/CLAUDE/melissa-bot/categories.json", "utf8"));

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// The columns may not exist yet if the app has not redeployed. Idempotent.
if (APPLY) {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS brief_morning TEXT NOT NULL DEFAULT '07:00'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS brief_evening TEXT NOT NULL DEFAULT '20:00'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS category_keywords JSONB NOT NULL DEFAULT '{}'::jsonb`);
}

const fold = (s) => String(s || "").trim().toLowerCase();
let refused = false;

for (const row of sqliteUsers) {
  const chatId = String(row.chat_id);
  const found = await pool.query(
    `SELECT id, email, tipo_options FROM users WHERE telegram_chat_id = $1`, [chatId]
  );
  if (found.rowCount === 0) {
    console.log(`\n⚠️  chat ${chatId} (${row.name}) no tiene cuenta en Postgres — se omite`);
    continue;
  }
  const user = found.rows[0];

  let chosen = [];
  try { chosen = JSON.parse(row.categories || "[]"); } catch { chosen = []; }
  if (!Array.isArray(chosen) || chosen.length === 0) chosen = shared;

  const used = (await pool.query(
    `SELECT tipo, COUNT(*)::int n FROM tasks WHERE user_id = $1 GROUP BY tipo`, [user.id]
  )).rows;
  const usedNames = used.map((r) => r.tipo);

  // Union, first spelling wins, case-insensitive.
  const merged = [];
  const seen = new Set();
  for (const name of [...chosen.map((c) => c.name), ...usedNames]) {
    const key = fold(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(String(name).trim());
  }

  const dropped = (user.tipo_options || []).filter((old) => !seen.has(fold(old)));
  const withTasks = dropped.filter((name) => used.some((r) => fold(r.tipo) === fold(name)));
  if (withTasks.length > 0) {
    console.log(`\n❌ ${user.email}: se caerían categorías CON tareas: ${withTasks.join(", ")}`);
    refused = true;
    continue;
  }

  const keywords = {};
  for (const c of chosen) {
    if (c && c.name && Array.isArray(c.keywords) && c.keywords.length) keywords[String(c.name).trim()] = c.keywords;
  }

  console.log(`\n── ${user.email}  (chat ${chatId})`);
  console.log(`   idioma=${row.language || "es"}  tz=${row.timezone}  briefs=${row.brief_morning}/${row.brief_evening}`);
  console.log(`   categorías antes (${(user.tipo_options||[]).length}): ${(user.tipo_options||[]).join(", ")}`);
  console.log(`   categorías después (${merged.length}): ${merged.join(", ")}`);
  if (dropped.length) console.log(`   se van (0 tareas cada una): ${dropped.join(", ")}`);
  console.log(`   keywords para ${Object.keys(keywords).length} categorías`);

  if (APPLY) {
    await pool.query(
      `UPDATE users SET language=$1, timezone=$2, brief_morning=$3, brief_evening=$4,
              tipo_options=$5::text[], category_keywords=$6::jsonb, updated_at=NOW()
       WHERE id=$7`,
      [row.language || "es", row.timezone || "America/Los_Angeles",
       row.brief_morning || "07:00", row.brief_evening || "20:00",
       merged, JSON.stringify(keywords), user.id]
    );
    console.log("   ✅ escrito");
  }
}

console.log(APPLY ? "\nAplicado." : refused ? "\nENSAYO — hay refusals arriba, no se escribió nada." : "\nEnsayo. Corre con `apply` para escribir.");
await pool.end();
