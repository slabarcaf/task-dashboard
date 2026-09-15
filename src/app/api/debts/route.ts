import { NextRequest, NextResponse } from "next/server";
import { crossOriginRefused, getBotUserIfAuthorized, getCurrentUserFromCookies, originIsTrusted } from "@/lib/server/auth";
import { DbUser, createDebtForUser, listDebtsByUser } from "@/lib/server/db";

export const runtime = "nodejs";

/**
 * Debts: "Debo yo" and "Me deben".
 *
 * Two doors, like /api/tasks and /api/user/preferences — a browser session or
 * the bot's bearer token plus the chat it acts for. They used to live only in
 * the bot's SQLite, which is why the web could not show them at all.
 */
async function resolveUser(request: NextRequest): Promise<DbUser | null> {
  return (await getCurrentUserFromCookies()) || (await getBotUserIfAuthorized(request));
}

export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, debts: await listDebtsByUser(user.id) });
}

export async function POST(request: NextRequest) {
  if (!originIsTrusted()) return crossOriginRefused();
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || "").trim();
  const amount = Number(body.amount);

  if (!name) return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  // Rejected rather than coerced: a debt of NaN or of zero is a mistake, and
  // storing it means someone reconciles it by hand later.
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  const debt = await createDebtForUser(user.id, {
    name,
    amount,
    currency: String(body.currency || "USD"),
    direction: String(body.direction || ""),
    reason: String(body.reason || "")
  });
  return NextResponse.json({ ok: true, debt });
}
