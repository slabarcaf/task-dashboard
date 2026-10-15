import { NextRequest, NextResponse } from "next/server";
import { authenticateMuse, notifyMuseWrite } from "@/lib/server/museAuth";
import { patchTaskForUser, type TaskPatch } from "@/lib/server/taskWrites";
import { STATUS_FINAL_OUTCOME_OPTIONS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATCHABLE = [
  "toDo",
  "statusFinalOutcome",
  "tipo",
  "nextStep",
  "dueDateNextStep",
  "recurrenceInterval",
  "recurrenceUnit",
  "isPriority"
] as const;

/**
 * Edita una tarea. El cuerpo es el patch directo (`{"statusFinalOutcome":"Done"}`),
 * sin el sobre `{patch: …}` de la ruta del bot: es lo que un modelo escribe a la
 * primera. Devuelve la fila como quedó escrita.
 *
 * Sin DELETE a propósito — ver `museAuth.ts`.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateMuse(request, "tasks");
  if ("response" in auth) return auth.response;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: TaskPatch = {};
    for (const key of PATCHABLE) {
      if (raw[key] !== undefined) (patch as Record<string, unknown>)[key] = raw[key];
    }
    // Un 200 sobre un no-op es exactamente la forma del bug de "ya lo hice".
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "missing_patch", allowed: PATCHABLE }, { status: 400 });
    }
    if (
      patch.statusFinalOutcome !== undefined &&
      !(STATUS_FINAL_OUTCOME_OPTIONS as readonly string[]).includes(String(patch.statusFinalOutcome))
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_status", allowed: STATUS_FINAL_OUTCOME_OPTIONS },
        { status: 400 }
      );
    }

    const result = await patchTaskForUser(auth.user.id, id, patch);
    if (!result.ok) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const { before, task, nextOccurrenceId } = result;
    const what =
      before.statusFinalOutcome !== task.statusFinalOutcome
        ? `marcó «${task.toDo}» como ${task.statusFinalOutcome}`
        : `editó «${task.toDo}» (${Object.keys(patch).join(", ")})`;
    await notifyMuseWrite(
      auth.user,
      `${what} · #${task.rowId}${nextOccurrenceId ? ` · siguiente: #${nextOccurrenceId}` : ""}`
    );
    return NextResponse.json({ ok: true, task, nextOccurrenceId });
  } catch (error) {
    console.warn("[muse/tasks/[id]]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
