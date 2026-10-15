import { NextRequest, NextResponse } from "next/server";
import { updateDebtForUser } from "@/lib/server/db";
import { authenticateMuse, notifyMuseWrite } from "@/lib/server/museAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `{"status":"Pagado"}` o `{"status":"Por pagar"}`. Nada más se acepta. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateMuse(request, "debts");
  if ("response" in auth) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    // Exacto, no la regex de la ruta web: allí cualquier cosa sin "pagad" vuelve
    // la deuda a "Por pagar", y un modelo que manda "paid" la reabriría.
    if (body.status !== "Pagado" && body.status !== "Por pagar") {
      return NextResponse.json(
        { ok: false, error: "invalid_status", allowed: ["Pagado", "Por pagar"] },
        { status: 400 }
      );
    }
    const debt = await updateDebtForUser(id, auth.user.id, body.status);
    if (!debt) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    await notifyMuseWrite(auth.user, `marcó deuda «${debt.name}» como ${debt.status} · #${debt.id}`);
    return NextResponse.json({ ok: true, debt });
  } catch (error) {
    console.warn("[muse/debts/[id]]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
