import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  DbUser,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findUserByEmail,
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

/**
 * Checks for an OpenClaw bot token in the Authorization header.
 * If valid, returns the owner user directly — no Google OAuth needed.
 * Returns null if the header is missing or the token doesn't match.
 */
export async function getBotUserIfAuthorized(request: NextRequest): Promise<DbUser | null> {
  const secret = process.env.OPENCLAW_API_SECRET;
  if (!secret) return null;

  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || token !== secret) return null;

  const ownerEmail = (process.env.DEFAULT_OWNER_EMAIL || "Santiago.labarca@berkeley.edu").trim();
  return findUserByEmail(ownerEmail);
}
