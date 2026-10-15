import { NextRequest, NextResponse } from "next/server";
import { API_TOKEN_PREFIX, ApiTokenScope, DbUser, findUserByApiToken } from "@/lib/server/db";
import { LIMITS, consumeRateLimit, tooManyRequests } from "@/lib/server/rateLimit";

/**
 * La puerta del conector de Muse: una llave personal (`syd_…`) por persona.
 *
 * **Deliberadamente separada** de `getBotUserIfAuthorized`. Esa acepta el
 * secreto compartido del bot más un chat id elegido por quien llama — o sea,
 * cualquier usuario —, y esta solo acepta llaves de una cuenta, con alcances,
 * que se revocan sin tocar al bot. Por eso las rutas de Muse viven bajo
 * `/api/muse/*` y no aceptan ni el bearer del bot ni la cookie: un cliente de
 * terceros no tiene por qué compartir puerta con la web.
 *
 * Tampoco hay DELETE en ninguna ruta de Muse. Completar no es borrar, y un
 * modelo ajeno que se confunde de tarea es recuperable solo si no borra.
 */
export async function authenticateMuse(
  request: NextRequest,
  scope: ApiTokenScope
): Promise<{ user: DbUser; scopes: ApiTokenScope[] } | { response: Response }> {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.startsWith(API_TOKEN_PREFIX)) {
    return { response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const found = await findUserByApiToken(token);
  if (!found) {
    return { response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!found.scopes.includes(scope)) {
    return { response: NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 }) };
  }

  // El mismo tope de escrituras que la web, pero contado aparte y para todo
  // (lecturas incluidas): un agente en bucle no debe poder martillar la base.
  const verdict = await consumeRateLimit(`muse:${found.tokenId}`, LIMITS.writes);
  if (!verdict.allowed) return { response: tooManyRequests(verdict.retryAfterSeconds) };

  return { user: found.user, scopes: found.scopes };
}

/**
 * El sustituto del guard anti-"ya lo hice" del bot.
 *
 * Ese guard vive en `melissa.js` y no corre cuando quien habla es el modelo de
 * Muse. Así que cada escritura real hecha por Muse deja un aviso en el Telegram
 * de la persona, mandado desde aquí — después de que la base confirmó. Si Muse
 * dice que hizo algo y el aviso no llega, no pasó.
 *
 * Bot API directa, sin LLM: no cuesta nada. Best-effort: si falta
 * `TELEGRAM_BOT_TOKEN` o Telegram falla, la escritura ya ocurrió y no se
 * deshace por un aviso. Nunca se registra el texto, solo que falló.
 */
export async function notifyMuseWrite(user: DbUser, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !user.telegramChatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: `🟣 Muse: ${text}`,
        disable_notification: true
      }),
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) console.warn(`[muse] aviso de Telegram falló: ${response.status}`);
  } catch {
    console.warn("[muse] aviso de Telegram falló (red)");
  }
}
