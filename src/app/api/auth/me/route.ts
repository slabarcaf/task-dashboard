import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { isAdminUser } from "@/lib/server/admin";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      // Advisory only — it decides whether a link is drawn, never what the
      // server will hand over. Every /api/admin route checks again.
      isAdmin: isAdminUser(user)
    }
  });
}
