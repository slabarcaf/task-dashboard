# SECURITY.md — el modelo de confianza de Sydney

Sydney son dos mitades: esta web (Next.js en Vercel, Postgres en Neon) y el bot
de Telegram (`melissa-bot`, en una VM de Oracle). Guardan tareas, deudas y notas
de voz de personas reales. Este archivo dice **quién puede hacer qué y por qué**,
y qué hacer cuando algo se escapa.

Revisión completa: **2026-09-11**.

---

## Las tres puertas

| Puerta | Quién entra | Cómo se prueba |
|---|---|---|
| **Web** | Solo quien ya tiene fila en `users` | Google Identity Services: firma e `aud` verificados, y `email_verified` obligatorio |
| **Bot** | El bot, actuando *para* una persona | `Authorization: Bearer` comparado en tiempo constante + `X-Telegram-Chat-Id` resuelto a una fila |
| **Admin** | Las direcciones de `ADMIN_EMAILS` | Comparación de correo; **falla cerrado** si la variable no está |

**Solo por invitación.** Firmar con Google prueba quién eres, **no** que puedas
entrar. `linkGoogleIdentity` reclama una fila existente por `google_sub` o por
correo y devuelve `null` si no hay ninguna. El único lugar del sistema que crea
filas es `POST /api/admin/users`.

El rechazo es **idéntico** para una dirección nunca invitada y para una invitada
y luego borrada. Distinguirlas convierte la pantalla de acceso en un oráculo para
averiguar quién tiene cuenta.

> Si alguien dice "no puedo entrar", lo primero es mirar si tiene fila. No es que
> el login esté roto.

**El bearer del bot no dice de quién es la petición.** Dice que viene del bot; la
cabecera `X-Telegram-Chat-Id` dice la persona. **Quien tenga ese token puede
actuar como cualquier usuario eligiendo el chat id.** Es el diseño, no un
descuido — pero significa que el radio de explosión de ese único string es total,
y es la razón por la que rotarlo es la primera respuesta a cualquier sospecha.

---

## Aislamiento entre personas

Cada consulta lleva `user_id` en el `WHERE`. Las rutas con `[id]` **no** leen y
después comprueban: ponen el `user_id` en el `WHERE` del propio `UPDATE`/`DELETE`,
así que una mutación dirigida a la tarea de otra persona devuelve 404 desde la
base. No hay IDOR.

`npm run verify:sync` lo comprueba con dos cuentas desechables que crea y borra,
comparando el conteo de filas antes y después.

---

## Lo que se guarda, y cómo

- **Tokens de sesión: hasheados.** La cookie lleva 256 bits de azar; la tabla
  guarda su SHA-256. Un volcado de la base ya no es una sesión secuestrada.
  Sin sal y sin estirar a propósito: es un valor aleatorio, no una contraseña.
- **Cookie:** `httpOnly`, `sameSite=lax`, `secure` en producción, 15 días.
- **Origen verificado** en toda ruta que muta, como segunda capa sobre `Lax`.
  Una petición **sin** `Origin` se acepta: así llega el bot.
- **Audio de voz: no toca el disco.** El `Blob` va de `formData()` a Whisper y se
  descarta. En el bot sí toca disco, en un directorio propio `0700` que se borra.
- **No se registran contenidos.** Los logs guardan longitudes, no mensajes: en
  esa VM journald guardaría en texto plano las tareas, deudas y notas de voz de
  todo el mundo.

## Lo que cuesta dinero, y su límite

Los contadores viven en Postgres (`rate_limits`), no en memoria: en Vercel cada
instancia tiene su propia memoria, así que un contador local es un límite por
instancia, que bajo carga no es ningún límite.

| Ruta | Límite | Por qué |
|---|---|---|
| `/api/transcribe` | 30 / hora, por usuario | Whisper se paga por minuto de audio |
| invitaciones | 20 / día, por admin | Cada una es un correo; los no pedidos queman el dominio |
| escrituras | 300 / hora, por usuario | 561 tareas en seis meses es el uso real |
| acceso | 20 / 15 min, por IP | Verificar un ID token cuesta aunque falle |

**Falla abierto** si la base no responde: un limitador que tumba la app cuando no
puede contar es una caída autoinfligida.

---

## El bot y el texto que no escribió nadie de confianza

El modelo lee correos entrantes (`scan_gmail_for_actions`). Cualquiera puede
mandarle un correo a Santiago, así que **el contenido de un correo es un
atacante con voz dentro del contexto**.

La consecuencia peligrosa es `add_attendees`: agregar una dirección a un evento
privado hace que Google le mande los detalles a esa dirección. Eso es
exfiltración, y estaba defendido solo por una frase en el prompt — en un
repositorio donde las reglas por prompt han fallado tres veces.

Ahora se comprueba en código (`unvouchedAttendees`): una dirección solo puede ser
invitada si salió de algo que **la persona** controla — algo que escribió, o el
resultado de un `lookup_google_contact` que pidió. Una dirección que solo apareció
dentro del cuerpo de un correo se rechaza.

La autorización de herramientas se re-verifica en el servidor y no confía en la
lista que recibió el modelo.

⚠️ **Los `features` `calendar` y `email` no se le prenden a nadie más que a
Santiago.** Los servidores MCP arrancan con **un solo token OAuth global**, así
que ese flag no concede "calendario": concede *el calendario y el Gmail de
Santiago*. Es el hallazgo F2, abierto desde julio. **Ese flag es lo único que lo
impide.**

---

## Si algo se escapa

1. **Un secreto en una captura de pantalla, un log o un repositorio →
   rotarlo, no evaluarlo.** Un secreto que se vio está quemado. Discutir si
   alguien lo leyó cuesta más que rotarlo.
2. **`OPENCLAW_API_SECRET`:** cambiar en el `config.json` de la VM **y** en Vercel,
   en ese orden, y reiniciar el bot. Entre los dos pasos el bot da 401; son
   segundos y ninguna tarea se pierde.
3. **Una sesión que hay que cortar:** `deleteSessionsForUser(id)` la corta en
   todos los dispositivos.
4. **Cerrarle la puerta a alguien:** borrar su fila desde `/admin`. Sin fila no
   se puede entrar, y sus tareas y deudas se van con ella (`ON DELETE CASCADE`).
5. **El chequeo nocturno de las 02:00 es la alarma.** Un chequeo que no puede
   determinar su respuesta reporta falla, nunca aprobación.

## Lo que sigue abierto

- **El radio de explosión del token del bot** (arriba). Lo correcto sería un
  token por usuario o una lista blanca de chat ids en el servidor.
- **OAuth por usuario para Google** (hallazgo F2). Hasta que exista, el flag de
  `calendar` es una llave del Google de Santiago.
- **Avisos de `next` que quedan**: son de `next/image` y de reescrituras, y
  aplican a instalaciones *self-hosted*. Esta corre en Vercel, sin reescrituras.
  Los de `postcss` y compañía son de tiempo de compilación, no de ejecución.
- **Hosting, base de datos y login están en una cuenta universitaria.** Si esa
  cuenta se desactiva, el producto pierde host, datos y acceso de una vez.
