import { NextResponse } from "next/server";
import { getCurrentUserFromCookies, toAuthUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user: toAuthUser(user) });
}
