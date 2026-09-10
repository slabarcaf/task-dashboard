/** Creates exactly what a fresh Google sign-in produces: a row with no tasks and
 *  onboarding_completed = false. `clean` removes it. */
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const EMAIL = "nuevo-selftest@example.invalid";
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const q=(s,p)=>pool.query(s,p);
const wipe = async () => { for (const r of (await q(`SELECT id FROM users WHERE email=$1`,[EMAIL])).rows) {
  await q(`DELETE FROM tasks WHERE user_id=$1`,[r.id]); await q(`DELETE FROM users WHERE id=$1`,[r.id]); } };
const snap = async () => (await q(`SELECT (SELECT COUNT(*) FROM users)::int u,(SELECT COUNT(*) FROM tasks)::int t,(SELECT COUNT(*) FROM tasks WHERE user_id IS NULL)::int o`)).rows[0];

if (process.argv[2]==="clean") { await wipe(); const s=await snap();
  console.log("limpio: users=%d tasks=%d huérfanas=%d", s.u,s.t,s.o); await pool.end(); process.exit(0); }

await wipe();
// upsertGoogleUser writes exactly these columns for a first-time sign-in.
const id = Number((await q(
  `INSERT INTO users (email,name,google_sub) VALUES ($1,'Correo De Prueba',$2) RETURNING id`,
  [EMAIL, "selftest-sub-"+crypto.randomBytes(6).toString("hex")])).rows[0].id);
const row = (await q(`SELECT onboarding_completed, tipo_options, language, timezone, brief_morning, brief_evening FROM users WHERE id=$1`,[id])).rows[0];
console.log("fila creada:", JSON.stringify(row));
const token = crypto.randomBytes(32).toString("hex");
await q(`INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '40 minutes')`,[token,id]);
console.log("TOKEN="+token);
await pool.end();
