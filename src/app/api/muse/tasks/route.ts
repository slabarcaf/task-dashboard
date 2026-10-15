import { NextRequest, NextResponse } from "next/server";
import { filterTasks, parseTaskView } from "@/lib/museBrief";
import { getDbTaskByIdForUser, getUserPreferencesByUserId, listDbTasksByUser } from "@/lib/server/db";
import { authenticateMuse, notifyMuseWrite } from "@/lib/server/museAuth";
import { createTaskForUser, type TaskCreateInput } from "@/lib/server/taskWrites";
import { STATUS_FINAL_OUTCOME_OPTIONS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?view=open` (por defecto), `overdue_and_today` o `all`. */
export async function GET(request: NextRequest) {
  const auth = await authenticateMuse(request, "tasks");
  if ("response" in auth) return auth.response;
  try {
    const { timezone } = await getUserPreferencesByUserId(auth.user.id);
    const view = parseTaskView(request.nextUrl.searchParams.get("view"));
    const tasks = filterTasks(await listDbTasksByUser(auth.user.id), view, timezone);
    return NextResponse.json({ ok: true, view, count: tasks.length, tasks });
  } catch (error) {
    console.warn("[muse/tasks]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateMuse(request, "tasks");
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as TaskCreateInput;
    // Un modelo ajeno inventa estados ("Pending", "Completed"). Se rechaza en vez
    // de guardarlo: un estado desconocido saca la tarea de todas las vistas.
    if (
      body.statusFinalOutcome !== undefined &&
      !(STATUS_FINAL_OUTCOME_OPTIONS as readonly string[]).includes(String(body.statusFinalOutcome))
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_status", allowed: STATUS_FINAL_OUTCOME_OPTIONS },
        { status: 400 }
      );
    }
    const result = await createTaskForUser(auth.user.id, body);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "toDo and dueDateNextStep (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }
    const task = await getDbTaskByIdForUser(result.rowId, auth.user.id);
    await notifyMuseWrite(auth.user, `creó «${task?.toDo}» (vence ${task?.dueDateNextStep}) · #${result.rowId}`);
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    console.warn("[muse/tasks]", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
