# Muse ↔ Sydney

Meta Muse habla con Sydney por una API propia, `/api/muse/*`. **Sydney sigue
siendo la fuente de verdad**: Muse no tiene copia de las tareas ni de las
deudas, solo las lee y escribe aquí. Telegram y la web siguen funcionando igual
y ven los mismos datos.

Estado (2026-10-15): solo Santiago, tareas y deudas, lectura y escritura.

## Por qué una puerta aparte

El bot entra con `OPENCLAW_API_SECRET` más `X-Telegram-Chat-Id`. **Ese secreto,
con cualquier chat id, es cualquier usuario** (ver `SECURITY.md`). No se le
entrega a un tercero. Muse usa una **llave personal** (`syd_…`) que:

- pertenece a una sola cuenta;
- tiene alcances (`tasks`, `debts`);
- se revoca sin tocar al bot;
- se guarda como SHA-256, igual que las sesiones.

Las rutas de Muse **no** aceptan ni la cookie ni el bearer del bot, y el bearer
del bot tampoco abre estas rutas (`verify-muse.mjs` lo comprueba).

## Lo que Muse puede y no puede hacer

| Ruta | Qué hace |
|---|---|
| `GET /api/muse/brief` | Todo el feed matutino en una llamada. "Hoy" se calcula en la zona de la persona, no en UTC |
| `GET /api/muse/tasks?view=open\|overdue_and_today\|all` | Lista de tareas |
| `POST /api/muse/tasks` | Crea una tarea |
| `PATCH /api/muse/tasks/{rowId}` | Edita o completa una tarea. Una recurrente que pasa a Done crea la siguiente, igual que en la web |
| `GET /api/muse/debts?status=pending\|all` | Lista de deudas |
| `POST /api/muse/debts` | Anota una deuda (`direction` exacto: `Debo yo` o `Me deben`) |
| `PATCH /api/muse/debts/{id}` | `{"status":"Pagado"}` o `{"status":"Por pagar"}` |

**No hay DELETE.** Completar no es borrar, y si un modelo ajeno se equivoca de
tarea, el error solo se puede deshacer mientras no haya borrado nada.

Estados, direcciones y patches vacíos inventados se rechazan con 400, y la
respuesta trae los valores permitidos. La ruta web es más tolerante: adivina una
dirección ambigua y vuelve a "Por pagar" cualquier estado que no contenga
"pagad". Con un LLM de por medio, adivinar cuesta más que preguntar.

Todas las rutas comparten un tope de 300 llamadas por hora por llave, en
`rate_limits`.

## El sustituto del guard de "ya lo hice"

El guard de `melissa.js` impide que el bot diga "marqué la tarea" sin haberla
escrito. **Ese guard no corre cuando habla Muse.** Lo que lo sustituye:

1. Toda escritura devuelve la fila **como quedó en la base**, no un `ok`.
2. Cada escritura real manda un aviso silencioso a tu Telegram:
   `🟣 Muse: marcó «X» como Done · #123`. Sale directo por la Bot API, sin LLM y
   sin costo. **Si Muse dice que hizo algo y el aviso no llega, no pasó.**

El aviso necesita `TELEGRAM_BOT_TOKEN` en Vercel, con el mismo valor que el
token del bot en el `config.json` de la VM. Mandar mensajes no choca con el
polling del bot. Si falta la variable no hay avisos, pero las escrituras
funcionan igual.

## Puesta en marcha

1. **Vercel → Settings → Environment Variables**: agrega `TELEGRAM_BOT_TOKEN`
   (Production) y vuelve a desplegar.
2. **Emite la llave**, desde este repo y con `.env.local`:
   ```bash
   node scripts/api-token.mjs mint santiago.labarca@berkeley.edu "Meta Muse" tasks,debts
   ```
   Se imprime una sola vez. Pégala directo en Muse y en ningún otro lado.
3. **En Muse**, crea un conector personalizado:
   - Spec: `https://task-dashboard-c7q2.vercel.app/muse-openapi.yaml`
     (la descripción del spec trae las reglas de uso para el modelo)
   - Auth: Bearer, con la llave `syd_…`
4. **Feed matutino en Muse**: prográmalo para que llame a `getBrief` a la hora que
   quieras y lo resuma. Si además quieres el calendario, usa el conector de
   Google Calendar del propio Muse; Sydney no lo expone.
5. **Prueba**: pídele "¿qué tengo hoy?" y "marca X como hecha", y confirma que
   llega el aviso 🟣 a Telegram.
6. **Cuando lleves una semana usándolo**, apaga los briefs de Telegram. Vacía la
   hora de mañana y de tarde en Preferencias de la web. Son lo único que sigue
   gastando OpenAI aunque no le escribas al bot.

## Revocar

```bash
node scripts/api-token.mjs list   santiago.labarca@berkeley.edu
node scripts/api-token.mjs revoke santiago.labarca@berkeley.edu <id>
```

Si sospechas que la llave se filtró, revócala primero y averigua después. Revocar
no afecta al bot ni a la web.

## Verificar

```bash
node scripts/verify-muse.mjs                       # contra producción
BASE=http://localhost:3000 node scripts/verify-muse.mjs
```

Usa dos cuentas desechables y al final comprueba que la base quedó igual que
antes.
