import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { redeemTelegramLinkCode } from "@/lib/server/db";
import { crossOriginRefused, originIsTrusted } from "@/lib/server/auth";

export const runtime = "nodejs";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Called by the Sydney bot when someone sends `/link CODE`.
 *
 * Bot-token auth only. Unlike the task routes this one does NOT fall back to the
 * owner account: the chat id in the body is the thing being granted access, so a
 * fallback would hand the owner's tasks to whoever sent the command.
 */
export async function POST(request: NextRequest) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const secret = process.env.OPENCLAW_API_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const [scheme, token] = (request.headers.get("authorization") || "").split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token || !secretMatches(token, secret)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { code?: string; chatId?: string | number };
    const code = String(body.code || "").trim();
    const chatId = String(body.chatId || "").trim();
    if (!code || !chatId) {
      return NextResponse.json({ ok: false, error: "code and chatId are required" }, { status: 400 });
    }

    const result = await redeemTelegramLinkCode(code, chatId);
    if (!result.ok) {
      // The bot turns these into human sentences; keep them stable.
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
    }

    return NextResponse.json({ ok: true, user: { name: result.user.name, email: result.user.email } });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[telegram/redeem]", error);
    return NextResponse.json(
      { ok: false, error: "Could not link the account" },
      { status: 500 }
    );
  }
}
