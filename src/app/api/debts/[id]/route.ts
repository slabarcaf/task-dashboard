import { NextRequest, NextResponse } from "next/server";
import { crossOriginRefused, getBotUserIfAuthorized, getCurrentUserFromCookies, originIsTrusted } from "@/lib/server/auth";
import { DbUser, deleteDebtForUser, updateDebtForUser } from "@/lib/server/db";

export const runtime = "nodejs";

async function resolveUser(request: NextRequest): Promise<DbUser | null> {
  return (await getCurrentUserFromCookies()) || (await getBotUserIfAuthorized(request));
}

/**
 * Marks a debt paid or unpaid.
 *
 * The user id goes into the WHERE rather than being checked first, so a request
 * for somebody else's row does not update anything and returns 404 — the same
 * shape of isolation the tasks routes use.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!originIsTrusted()) return crossOriginRefused();
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Id inválido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const wantsPaid = /pagad/i.test(String(body.status || ""));
  const debt = await updateDebtForUser(id, user.id, wantsPaid ? "Pagado" : "Por pagar");
  if (!debt) return NextResponse.json({ ok: false, error: "No existe" }, { status: 404 });
  return NextResponse.json({ ok: true, debt });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!originIsTrusted()) return crossOriginRefused();
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Id inválido" }, { status: 400 });
  }
  const removed = await deleteDebtForUser(id, user.id);
  if (!removed) return NextResponse.json({ ok: false, error: "No existe" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
