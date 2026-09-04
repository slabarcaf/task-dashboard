import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  DbUser,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findUserByEmail,
  findUserByTelegramChatId,
  getUserBySessionToken
} from "@/lib/server/db";

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
 * resolves to that user, so each Telegram user reads and writes their own tasks.
 *
 * Without the header, or with a chat id no row claims yet, it falls back to the
 * owner account — the behaviour before per-user accounts existed. That fallback
 * is what makes this deployable ahead of the data migration: nothing breaks
 * while rows are still being linked. Once every chat is linked it should become
 * a rejection, so an unknown chat cannot silently read the owner's tasks.
 */
export async function getBotUserIfAuthorized(request: NextRequest): Promise<DbUser | null> {
  const secret = process.env.OPENCLAW_API_SECRET;
  if (!secret) return null;

  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || !secretMatches(token, secret)) return null;

  const chatId = request.headers.get("x-telegram-chat-id")?.trim();
  if (chatId) {
    const user = await findUserByTelegramChatId(chatId);
    if (user) return user;
  }

  // Every account that exists is linked, so this fallback can no longer help
  // anybody — it can only hand the owner's tasks to a chat nobody claimed. It
  // stays for now because the older Telegram-only invite path still creates bot
  // users with no Postgres row, and removing it would 401 them instead. Log
  // loudly so that if it ever fires there is a trace, and see ACCESS-DESIGN.md
  // for the fix: give the invite flow a real account instead of a fallback.
  if (chatId) {
    console.warn(`[auth] chat ${chatId} is not linked to any account — falling back to the owner`);
  }

  const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu").trim();
  return findUserByEmail(ownerEmail);
}
