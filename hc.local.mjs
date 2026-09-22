import { readFileSync } from "node:fs"; import pg from "pg";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const pool=new pg.Pool({connectionString:env.DATABASE_URL});
// El chat id sale del entorno: cablearlo aquí ponía el de una persona real en
// un archivo del repo, y este script solo corre a mano.
const chatId = process.env.HC_CHAT_ID;
if (!chatId) throw new Error("Falta HC_CHAT_ID (el telegram_chat_id contra el que probar).");
const uid=(await pool.query(`SELECT id FROM users WHERE telegram_chat_id=$1`, [chatId])).rows[0].id;
if (process.argv[2]==="clean"){const r=await pool.query(`DELETE FROM debts WHERE name LIKE 'SELFTEST%'`);
  console.log("borradas:",r.rowCount,"| total ahora:",(await pool.query(`SELECT COUNT(*)::int n FROM debts`)).rows[0].n);}
else {await pool.query(`INSERT INTO debts (user_id,name,amount,currency,direction,status) VALUES
  ($1,'SELFTEST direccion mala',10,'USD','Quizás','Por pagar'),
  ($1,'SELFTEST monto negativo',-99,'USD','Me deben','Por pagar')`,[uid]);console.log("insertadas 2 corruptas");}
await pool.end();
