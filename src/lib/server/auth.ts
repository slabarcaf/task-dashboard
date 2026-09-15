import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/server/admin";
import {
  DbUser,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findUserByTelegramChatId,
  getUserBySessionToken
} from "@/lib/server/db";

/**
 * La forma en que la sesión describe a su dueño. **Las dos rutas que entregan un
 * usuario tienen que usar esta.**
 *
 * `/api/auth/google` y `/api/auth/me` construían cada una su propio objeto, y se
 * separaron: la del ingreso devolvía solo id, correo y nombre. El efecto era que
 * justo después de entrar la cabecera no mostraba "Usuarios" a un administrador
 * —aparecía sola al volver de otra pantalla, cuando `/api/auth/me` corría— y el
 * aviso de conectar Telegram salía aunque ya estuviera conectado.
 *
 * Dos lugares que arman el mismo objeto es cómo terminan discrepando, y el que
 * discrepa es siempre el que se olvida de actualizar.
 */
export function toAuthUser(user: DbUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Solo informativo: decide si se dibuja un enlace, nunca lo que el servidor
    // entrega. Cada ruta de /api/admin vuelve a comprobarlo.
    isAdmin: isAdminUser(user),
    telegramLinked: Boolean(user.telegramChatId)
  };
}

export const SESSION_COOKIE_NAME = "taskdash_session";
const SESSION_DAYS = 15;

export function getSessionExpiryDate(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_DAYS);
  return expiry;
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
}

export async function createUserSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  await deleteExpiredSessions();
  const expiresAt = getSessionExpiryDate();
  const token = await createSession(userId, expiresAt);
  return { token, expiresAt };
}

export async function destroyCurrentSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await deleteSession(token);
}

export async function getCurrentUserFromCookies(): Promise<DbUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

export function getCurrentSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}

/** Constant-time compare so the shared secret can't be probed byte by byte. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Authenticates a request from the Sydney bot.
 *
 * The bearer token proves the request came from the bot; the X-Telegram-Chat-Id
 * header says *which person* it is acting for. A chat id that maps to a user row
 * resolves to that user, so each Telegram user reads and writes their own data.
 *
 * ⚠️ There is deliberately **no fallback to the owner account**. There used to
 * be one, from before per-user accounts existed, and it was already unreachable
 * for anyone real: every account that exists is linked. It stayed because
 * removing it would 401 a Telegram-only user instead of serving them — which,
 * read the other way, means it would have served them *the owner's data*.
 *
 * Removing it became urgent when preferences moved here: with the fallback in
 * place, a Telegram-only user finishing onboarding would have written their
 * language, timezone and brief times onto the owner's account. A 401 the bot
 * logs and works around is a far better outcome than one person's onboarding
 * silently reconfiguring another person's.
 *
 * The consequence, stated plainly: a Telegram chat with no linked web account
 * cannot read or write through this API at all. Both current users are linked.
 * Giving that path a real account is the open item in ACCESS-DESIGN.md.
 */
export async function getBotUserIfAuthorized(request: NextRequest): Promise<DbUser | null> {
  const secret = process.env.OPENCLAW_API_SECRET;
  if (!secret) return null;

  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || !secretMatches(token, secret)) return null;

  const chatId = request.headers.get("x-telegram-chat-id")?.trim();
  if (!chatId) {
    console.warn("[auth] bot request without X-Telegram-Chat-Id — refused");
    return null;
  }

  const user = await findUserByTelegramChatId(chatId);
  if (!user) {
    console.warn(`[auth] chat ${chatId} is not linked to any account — refused`);
    return null;
  }
  return user;
}

/**
 * Segunda cerradura contra CSRF.
 *
 * La cookie ya es `SameSite=Lax`, que en los navegadores de hoy basta para que
 * un POST desde otro sitio no la lleve. Basta *hoy*: el día que alguien ponga
 * `sameSite: "none"` por una razón que parecerá buena, o que esto corra dentro
 * de un webview que no aplique Lax por defecto, no queda nada. Y `transcribe`
 * recibe `multipart/form-data`, que es exactamente lo que un formulario ajeno
 * sí puede enviar.
 *
 * Se acepta una petición **sin** `Origin` a propósito: así llegan el bot y
 * cualquier cliente que no sea un navegador, y esos ya se autentican con el
 * bearer. Lo que se rechaza es un `Origin` presente que no es el nuestro —
 * justo lo que manda un navegador en una petición entre sitios.
 *
 * Lee de `next/headers` y no del `NextRequest` para que sirva igual en los
 * handlers que no reciben la petición (`/api/auth/logout`, `/api/telegram/link`).
 */
export function originIsTrusted(): boolean {
  const incoming = headers();
  const origin = incoming.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  // Detrás del proxy de Vercel el host real llega reenviado; comparar solo
  // contra `host` rechazaría peticiones legítimas del propio dominio.
  const candidates = [incoming.get("x-forwarded-host"), incoming.get("host")].filter(
    (value): value is string => Boolean(value)
  );
  return candidates.some((host) => host === originHost);
}

/** El mismo rechazo para todos, para que ninguna ruta invente su propio texto. */
export function crossOriginRefused(): NextResponse {
  return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
}
