import { readFileSync } from "node:fs"; import crypto from "node:crypto"; import pg from "pg";
for (const l of readFileSync(".env.local","utf8").split("\n")) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^"|"$/g,""); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });
const { rows } = await pool.query(`INSERT INTO users (email,name,onboarding_completed,language,tipo_options)
  VALUES ('demo-shots@example.invalid','Demo',TRUE,'en',
  ARRAY['Work','Estudios','Finanzas','Personal','Otros']::text[]) RETURNING id`);
const id = rows[0].id;
const d = (n) => { const x = new Date(); x.setDate(x.getDate()+n);
  return x.toISOString().slice(0,10); };
const tasks = [
  ["Send the quarterly report to Maria","Work",-3,"To-do",true],
  ["Renew the apartment insurance","Personal",-1,"To-do",false],
  ["Pay the electricity bill","Finanzas",0,"To-do",true],
  ["Review pull request #212","Work",0,"To-do",false],
  ["Book flights for the conference","Work",1,"To-do",false],
  ["Problem set 4","Estudios",2,"To-do",false],
  ["Call the bank about the transfer","Finanzas",4,"To-do",false],
  ["Draft the onboarding email","Work",9,"To-do",false],
  ["Update the CV","Personal",0,"Done",false]
];
for (const [t,tipo,off,st,pri] of tasks) {
  await pool.query(`INSERT INTO tasks (user_id,to_do,status_final_outcome,tipo,next_step,
    due_date_next_step,status_next_step,is_priority) VALUES ($1,$2,$3,$4,'',$5,'',$6)`,
    [id,t,st,tipo,d(off),pri]);
}
const token = crypto.randomBytes(24).toString("hex");
await pool.query("INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,NOW()+interval '30 minutes')",
  [crypto.createHash("sha256").update(token).digest("hex"), id]);
console.log("TOKEN", token);
await pool.end();
