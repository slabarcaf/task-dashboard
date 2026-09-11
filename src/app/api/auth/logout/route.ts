import { NextResponse } from "next/server";
import { clearSessionCookie, crossOriginRefused, destroyCurrentSession, getCurrentSessionToken, originIsTrusted } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  if (!originIsTrusted()) return crossOriginRefused();
  const token = getCurrentSessionToken();
  await destroyCurrentSession(token);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
