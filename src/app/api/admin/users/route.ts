import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { isAdminUser } from "@/lib/server/admin";
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
 * Pre-creates an account by email.
 *
 * There is no mail being sent here, and the response says so rather than letting
 * the screen imply an invitation went out. What this does is real but narrower:
 * the row exists, so when that person signs in with Google, `upsertGoogleUser`
 * matches them by email and attaches their Google id to *this* account instead
 * of making a second one. Handing them the link is still a human step.
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
  return NextResponse.json({ ok: true, user: { id: created.id, email: created.email } });
}
