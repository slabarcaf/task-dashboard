import { readFileSync } from "node:fs"; import crypto from "node:crypto"; import pg from "pg";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const EMAIL="voz-e2e@example.invalid";
const pool=new pg.Pool({connectionString:env.DATABASE_URL}); const q=(s,p)=>pool.query(s,p);
const wipe=async()=>{for(const r of (await q(`SELECT id FROM users WHERE email=$1`,[EMAIL])).rows){
  await q(`DELETE FROM tasks WHERE user_id=$1`,[r.id]);await q(`DELETE FROM users WHERE id=$1`,[r.id]);}};
if(process.argv[2]==="clean"){await wipe();const s=(await q(`SELECT (SELECT COUNT(*) FROM users)::int u,(SELECT COUNT(*) FROM tasks)::int t`)).rows[0];
  console.log("limpio: users=%d tasks=%d",s.u,s.t);await pool.end();process.exit(0);}
await wipe();
const id=Number((await q(`INSERT INTO users (email,name,onboarding_completed,tipo_options,language) VALUES ($1,'Voz E2E',TRUE,ARRAY['Finanzas','Ayudantias','Personal','Otros']::text[],'es') RETURNING id`,[EMAIL])).rows[0].id);
const token=crypto.randomBytes(32).toString("hex");
await q(`INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '15 minutes')`,[token,id]);
console.log("TOKEN="+token);await pool.end();
