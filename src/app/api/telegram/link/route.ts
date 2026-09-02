import { NextResponse } from "next/server";
import { createTelegramLinkCode } from "@/lib/server/db";
import { getCurrentUserFromCookies } from "@/lib/server/auth";

export const runtime = "nodejs";

/**
 * Mints a short code the signed-in person types into Telegram as `/link CODE`.
 *
 * Cookie auth only — deliberately not reachable with the bot's bearer token.
 * The whole point is that a real browser session proves who is asking; letting
 * the shared bot secret mint codes would let anyone holding it claim any account.
 */
export async function POST() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { code, expiresAt } = await createTelegramLinkCode(user.id);
    return NextResponse.json({ ok: true, code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create a code" },
      { status: 500 }
    );
  }
}
