import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { isAdminUser } from "@/lib/server/admin";
import {
  deleteUserAndTheirTasks,
  getUserById,
  resetUserOnboarding,
  unlinkTelegramForUser
} from "@/lib/server/db";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getCurrentUserFromCookies();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdminUser(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { admin: user };
}

function parseId(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Actions that change an account without destroying anything: reset, unlink. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (body.action === "reset_onboarding") {
    await resetUserOnboarding(id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unlink_telegram") {
    await unlinkTelegramForUser(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/**
 * Deletes an account and its tasks.
 *
 * The caller must send the target's exact email in `confirmEmail`. This is the
 * one place the "undo instead of confirm" rule does not apply: there is no undo
 * for a deleted account, and an id in a URL is far too easy to get wrong.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const admin = auth.admin!;

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete your own account here." }, { status: 400 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (isAdminUser(target)) {
    return NextResponse.json({ error: "Admin accounts cannot be deleted here." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirmEmail?: string };
  const typed = String(body.confirmEmail || "").trim().toLowerCase();
  if (typed !== target.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Type the account's email exactly to confirm deletion." },
      { status: 400 }
    );
  }

  const result = await deleteUserAndTheirTasks(id);
  return NextResponse.json({ ok: true, ...result });
}
