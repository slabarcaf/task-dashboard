import { NextRequest, NextResponse } from "next/server";
import { createDebtForUser, listDebtsByUser } from "@/lib/server/db";
import { authenticateMuse, notifyMuseWrite } from "@/lib/server/museAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?status=pending` (por defecto) o `all`. */
export async function GET(request: NextRequest) {
  const auth = await authenticateMuse(request, "debts");
  if ("response" in auth) return auth.response;
  try {
    const all = request.nextUrl.searchParams.get("status") === "all";
    const debts = (await listDebtsByUser(auth.user.id)).filter((d) => all || d.status !== "Pagado");
    return NextResponse.json({ ok: true, count: debts.length, debts });
  } catch (error) {
    console.warn("[muse/debts]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateMuse(request, "debts");
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const amount = Number(body.amount);
    const direction = String(body.direction || "");
    if (!name) return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
    }
    // La ruta web adivina "Me deben" ante un texto ambiguo. Para un modelo ajeno
    // no: una deuda al revés es peor que un 400 que le pide aclarar.
    if (direction !== "Debo yo" && direction !== "Me deben") {
      return NextResponse.json(
        { ok: false, error: "invalid_direction", allowed: ["Debo yo", "Me deben"] },
        { status: 400 }
      );
    }
    const debt = await createDebtForUser(auth.user.id, {
      name,
      amount,
      currency: String(body.currency || "USD"),
      direction,
      reason: String(body.reason || "")
    });
    await notifyMuseWrite(
      auth.user,
      `anotó deuda «${debt.name}» ${debt.amount} ${debt.currency} (${debt.direction}) · #${debt.id}`
    );
    return NextResponse.json({ ok: true, debt });
  } catch (error) {
    console.warn("[muse/debts]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
