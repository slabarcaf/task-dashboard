import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { isAdminUser } from "@/lib/server/admin";
import { listAdminUserOverview } from "@/lib/server/db";

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
