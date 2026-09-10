import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { createTelegramLinkCode, unlinkTelegramForUser } from "@/lib/server/db";
import { getCurrentUserFromCookies } from "@/lib/server/auth";

export const runtime = "nodejs";

/**
 * The bot's Telegram handle. The web has no other way to know it — the bot reads
 * it from getMe at boot and nothing shares it across the two halves.
 */
const BOT_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_BOT || "Melizion_bot").replace(/^@/, "");

/**
 * Mints a code and everything needed to walk into the chat with it.
 *
 * The web's job here is to be a **door to Telegram, not a copy of it**: a QR for
 * the phone in your hand, a tappable link for the phone you are already on, and
 * the bare code for when neither works. A `t.me` link is both a real web page
 * and an app link, so it degrades instead of breaking — no Telegram installed
 * means an install page that still carries the payload, which is why these codes
 * last 24 hours rather than 15 minutes.
 *
 * Cookie auth only — deliberately not reachable with the bot's bearer token. A
 * real browser session proves who is asking; letting the shared secret mint
 * codes would let anyone holding it claim any account.
 */
export async function POST() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { code, expiresAt } = await createTelegramLinkCode(user.id);
    const deepLink = `https://t.me/${BOT_USERNAME}?start=link_${code}`;

    // Rendered here rather than in the browser: it keeps a QR library out of the
    // client bundle, and the value encoded is one the server already computed.
    const qrDataUrl = await QRCode.toDataURL(deepLink, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#151A3A", light: "#FFFFFF" }
    });

    return NextResponse.json({
      ok: true,
      code,
      deepLink,
      qrDataUrl,
      botUsername: BOT_USERNAME,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create a code" },
      { status: 500 }
    );
  }
}

/**
 * Disconnects this account's Telegram chat.
 *
 * Self-service, and separate from the admin action of the same name: this one
 * can only ever act on the session's own account, so there is no id to get wrong.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUserFromCookies();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    await unlinkTelegramForUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not disconnect" },
      { status: 500 }
    );
  }
}
