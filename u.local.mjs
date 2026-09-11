import { readFileSync } from "node:fs"; import pg from "pg";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const pool=new pg.Pool({connectionString:env.DATABASE_URL});
for(const r of (await pool.query(`SELECT id,email,name,(SELECT COUNT(*)::int FROM tasks t WHERE t.user_id=u.id) tareas FROM users u ORDER BY id`)).rows) console.log(" ",JSON.stringify(r));
await pool.end();
