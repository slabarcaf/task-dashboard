import { NextRequest, NextResponse } from "next/server";
import { buildBrief } from "@/lib/museBrief";
import { getUserPreferencesByUserId, listDbTasksByUser, listDebtsByUser } from "@/lib/server/db";
import { authenticateMuse } from "@/lib/server/museAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Todo el feed matutino en una llamada: vencidas, de hoy, prioritarias, próximos
 * tres días y deudas pendientes, con "hoy" calculado en la zona de la persona.
 *
 * Pide el alcance `tasks`; las deudas solo se incluyen si la llave también
 * tiene `debts`, para que quitarle ese alcance a la llave las saque de verdad.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateMuse(request, "tasks");
  if ("response" in auth) return auth.response;
  try {
    const [prefs, tasks, debts] = await Promise.all([
      getUserPreferencesByUserId(auth.user.id),
      listDbTasksByUser(auth.user.id),
      auth.scopes.includes("debts") ? listDebtsByUser(auth.user.id) : Promise.resolve([])
    ]);
    return NextResponse.json({ ok: true, ...buildBrief(tasks, debts, prefs.timezone) });
  } catch (error) {
    console.warn("[muse/brief]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
