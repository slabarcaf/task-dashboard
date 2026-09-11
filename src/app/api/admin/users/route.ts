import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { isAdminUser } from "@/lib/server/admin";
import { sendInviteEmail } from "@/lib/server/mail";
import { createUser, findUserByEmail, listAdminUserOverview } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Cookie session only — never the bot's bearer token.
 *
 * `getBotUserIfAuthorized` resolves a shared secret to the owner account, and
 * the owner is the admin, so accepting it here would turn one static string
 * living in the bot's config.json into a key to everyone's account summary.
 * Admin is a thing a person is signed in as, not a thing a service can hold.
 */
export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // The admin flag is decided here, not in db.ts: which addresses are admin is
  // a deployment question, and the data layer has no business knowing it.
  const users = (await listAdminUserOverview()).map((row) => ({
    ...row,
    isAdminAccount: isAdminUser(row)
  }));
  return NextResponse.json({ ok: true, users, viewerId: user.id });
}

/**
 * Creates an account and invites the person to it.
 *
 * ⚠️ Worth being straight about what the account itself buys, because it is
 * less than it looks: **anyone with a Google account can already sign in and get
 * one made automatically.** Pre-creating does not gate anything. What it does
 * give is a name attached before they arrive, and — the part that actually
 * earns its keep — a row in the admin table whose last sign-in reads "nunca",
 * which is how you find out an invitation never landed.
 *
 * The mail is the real feature, and it only goes out when RESEND_API_KEY is set.
 * When it is not, the response says so and the screen hands over a message to
 * send by hand instead of pretending something was delivered.
 *
 * If this should ever become real access control — only invited addresses may
 * sign in — that is a decision about the sign-in route, not about this one.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();

  // Deliberately loose: the authority on whether an address works is Google, at
  // sign-in. This only catches a typo that could never be an address at all.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Ese correo no parece válido." }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
  }

  const created = await createUser({ email, name });

  // La dirección real desde la que llegó esta petición, no una constante que se
  // queda vieja el día que cambie el dominio.
  const origin = request.nextUrl.origin;
  const mail = await sendInviteEmail({
    to: email,
    appUrl: origin,
    invitedBy: user.name || user.email
  });

  return NextResponse.json({
    ok: true,
    user: { id: created.id, email: created.email },
    // La pantalla dice lo que pasó de verdad. Una invitación que el producto
    // afirma haber mandado y no mandó es peor que no tener invitaciones.
    invite: mail.sent
      ? { sent: true as const }
      : { sent: false as const, reason: mail.reason, appUrl: origin }
  });
}
