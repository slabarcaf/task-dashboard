/**
 * Doble chequeo de sincronía web ↔ Telegram.
 *
 *   node scripts/verify-sync.mjs                 # contra producción
 *   BASE=http://localhost:3000 node scripts/verify-sync.mjs
 *
 * Corre contra la base real, así que vale la pena decir qué NO hace: las cuentas
 * de personas de verdad solo se leen. Todo lo que escribe va a una cuenta
 * desechable que crea y borra, y al final compara los totales de la base con los
 * de antes de empezar.
 *
 * Usa una cuenta desechable con un chat id ficticio y escribe por UNA puerta,
 * leyendo por la OTRA. Al final la borra y compara el estado de la base con el
 * de antes. Las cuentas reales solo se leen, nunca se tocan.
 */
import { readFileSync } from "node:fs"; import crypto from "node:crypto"; import pg from "pg";
const env=Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const BASE = process.env.BASE || "https://task-dashboard-c7q2.vercel.app";
const SECRET = env.OPENCLAW_API_SECRET;
const EMAIL = "sync-selftest@example.invalid";
const CHAT = "555000111222";
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const q=(s,p)=>pool.query(s,p);

let pass=0, fail=0;
const check=(ok,label,extra="")=>{ ok?pass++:fail++; console.log(`${ok?"✅":"❌"} ${label}${extra?"  — "+extra:""}`); };

const before=(await q(`SELECT (SELECT COUNT(*) FROM users)::int u,(SELECT COUNT(*) FROM tasks)::int t,(SELECT COUNT(*) FROM debts)::int d`)).rows[0];

for(const r of (await q(`SELECT id FROM users WHERE email=$1`,[EMAIL])).rows){
  await q(`DELETE FROM debts WHERE user_id=$1`,[r.id]); await q(`DELETE FROM tasks WHERE user_id=$1`,[r.id]); await q(`DELETE FROM users WHERE id=$1`,[r.id]);}

const uid=Number((await q(`INSERT INTO users (email,name,onboarding_completed,tipo_options,telegram_chat_id,language,timezone,brief_morning,brief_evening)
  VALUES ($1,'Sync Test',TRUE,ARRAY['Personal','Finanzas','Otros']::text[],$2,'es','America/Los_Angeles','07:00','20:00') RETURNING id`,[EMAIL,CHAT])).rows[0].id);
const token=crypto.randomBytes(32).toString("hex");
await q(`INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '20 minutes')`,[token,uid]);

const WEB={Cookie:`taskdash_session=${token}`,"Content-Type":"application/json"};
const BOT={Authorization:`Bearer ${SECRET}`,"X-Telegram-Chat-Id":CHAT,"Content-Type":"application/json"};
const get=async(path,h)=>(await fetch(BASE+path,{headers:h,cache:"no-store"})).json();
const send=async(path,h,method,body)=>{const r=await fetch(BASE+path,{method,headers:h,body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json().catch(()=>({}))};};
const today=new Date().toLocaleDateString("en-CA");

console.log("\n── TAREAS ──");
const t1=await send("/api/tasks",WEB,"POST",{toDo:"creada en la WEB",statusFinalOutcome:"To-do",tipo:"Personal",nextStep:"",dueDateNextStep:today,statusNextStep:""});
const botSees=(await get("/api/tasks",BOT)).tasks||[];
check(botSees.some(t=>t.toDo==="creada en la WEB"),"web → Telegram: la tarea aparece del otro lado");

const t2=await send("/api/tasks",BOT,"POST",{toDo:"creada en TELEGRAM",statusFinalOutcome:"To-do",tipo:"Finanzas",nextStep:"",dueDateNextStep:today,statusNextStep:""});
const webSees=(await get("/api/tasks",WEB)).tasks||[];
check(webSees.some(t=>t.toDo==="creada en TELEGRAM"),"Telegram → web: la tarea aparece del otro lado");

const target=webSees.find(t=>t.toDo==="creada en la WEB");
// La ruta espera los campos dentro de `patch`, como mandan la web y tasks-mcp.
const patchRes = await send(`/api/tasks/${target.rowId}`,BOT,"PATCH",{patch:{statusFinalOutcome:"Done",isPriority:true}});
const afterPatch=((await get("/api/tasks",WEB)).tasks||[]).find(t=>t.rowId===target.rowId);
check(afterPatch?.statusFinalOutcome==="Done"&&afterPatch?.isPriority===true,
  "Telegram edita → la web ve el cambio", `HTTP ${patchRes.status} estado=${afterPatch?.statusFinalOutcome} prioridad=${afterPatch?.isPriority}`);
const vacio = await send(`/api/tasks/${target.rowId}`,BOT,"PATCH",{statusFinalOutcome:"Done"});
check(vacio.status===400,"un cuerpo mal formado se rechaza en vez de mentir un ok", `HTTP ${vacio.status}`);

console.log("\n── DEUDAS ──");
await send("/api/debts",WEB,"POST",{name:"deuda WEB",amount:120,currency:"USD",direction:"Me deben",reason:"prueba"});
const botDebts=(await get("/api/debts",BOT)).debts||[];
check(botDebts.some(d=>d.name==="deuda WEB"),"web → Telegram: la deuda aparece del otro lado");

await send("/api/debts",BOT,"POST",{name:"deuda TELEGRAM",amount:75.5,currency:"CLP",direction:"Debo yo",reason:"prueba"});
const webDebts=(await get("/api/debts",WEB)).debts||[];
check(webDebts.some(d=>d.name==="deuda TELEGRAM"),"Telegram → web: la deuda aparece del otro lado");

const dTarget=webDebts.find(d=>d.name==="deuda WEB");
await send(`/api/debts/${dTarget.id}`,BOT,"PATCH",{status:"Pagado"});
const dAfter=((await get("/api/debts",WEB)).debts||[]).find(d=>d.id===dTarget.id);
check(dAfter?.status==="Pagado","Telegram marca pagada → la web lo ve", `estado=${dAfter?.status}`);

console.log("\n── PREFERENCIAS ──");
await send("/api/user/preferences",WEB,"POST",{briefMorning:"06:15",tipoOptions:["Personal","Finanzas","Otros","Viajes"]});
const botPrefs=await get("/api/user/preferences",BOT);
check(botPrefs.briefMorning==="06:15","web cambia el brief → Telegram lo ve", botPrefs.briefMorning);
check(botPrefs.tipoOptions.includes("Viajes"),"web agrega categoría → Telegram la ve", botPrefs.tipoOptions.join(","));

await send("/api/user/preferences",BOT,"POST",{timezone:"America/Santiago",language:"en"});
const webPrefs=await get("/api/user/preferences",WEB);
check(webPrefs.timezone==="America/Santiago"&&webPrefs.language==="en","Telegram cambia zona/idioma → la web lo ve",
  `${webPrefs.timezone} / ${webPrefs.language}`);
check(webPrefs.briefMorning==="06:15","escritura parcial: el brief que puso la web sobrevivió", webPrefs.briefMorning);
check(webPrefs.tipoOptions.includes("Viajes"),"escritura parcial: las categorías sobrevivieron");

console.log("\n── AISLAMIENTO ──");
const otro=await send(`/api/tasks/${target.rowId}`,{Authorization:`Bearer ${SECRET}`,"X-Telegram-Chat-Id":"<owner-chat-id>","Content-Type":"application/json"},"PATCH",{patch:{toDo:"secuestrada"}});
check(otro.status===404,"otro chat no puede tocar esta tarea", `HTTP ${otro.status}`);
const sigue=((await get("/api/tasks",WEB)).tasks||[]).find(t=>t.rowId===target.rowId);
check(sigue?.toDo==="creada en la WEB","...y el título quedó intacto", sigue?.toDo);

await q(`DELETE FROM debts WHERE user_id=$1`,[uid]);
await q(`DELETE FROM tasks WHERE user_id=$1`,[uid]);
await q(`DELETE FROM users WHERE id=$1`,[uid]);
const after=(await q(`SELECT (SELECT COUNT(*) FROM users)::int u,(SELECT COUNT(*) FROM tasks)::int t,(SELECT COUNT(*) FROM debts)::int d`)).rows[0];
console.log(`\nantes: users=${before.u} tasks=${before.t} debts=${before.d}`);
console.log(`después: users=${after.u} tasks=${after.t} debts=${after.d}`);
check(before.u===after.u&&before.t===after.t&&before.d===after.d,"la base quedó exactamente como estaba");
console.log(`\n${pass} pasaron, ${fail} fallaron`);
await pool.end();
process.exit(fail?1:0);
