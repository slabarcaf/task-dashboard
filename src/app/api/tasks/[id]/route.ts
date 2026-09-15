import { NextRequest, NextResponse } from "next/server";
import { createDbTaskForUser, deleteDbTaskForUser, getDbTaskByIdForUser, updateDbTaskForUser } from "@/lib/server/db";
import { computeStatusNextStep } from "@/lib/server/status";
import { crossOriginRefused, getBotUserIfAuthorized, getCurrentUserFromCookies, originIsTrusted } from "@/lib/server/auth";

export const runtime = "nodejs";

function normalizeDateInput(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const ddmmyyyy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function addRecurringInterval(
  dueDateIso: string,
  interval: number,
  unit: "day" | "week" | "month"
): string {
  const [year, month, day] = dueDateIso.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (unit === "day") {
    date.setDate(date.getDate() + interval);
  } else if (unit === "week") {
    date.setDate(date.getDate() + interval * 7);
  } else {
    date.setMonth(date.getMonth() + interval);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const user = (await getBotUserIfAuthorized(request)) ?? (await getCurrentUserFromCookies());
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(context.params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const deleted = await deleteDbTaskForUser(id, user.id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[tasks/[id]]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  if (!originIsTrusted()) return crossOriginRefused();
  try {
    const user = (await getBotUserIfAuthorized(request)) ?? (await getCurrentUserFromCookies());
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(context.params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "Invalid task id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      patch?: Partial<{
        toDo: string;
        statusFinalOutcome: string;
        tipo: string;
        nextStep: string;
        dueDateNextStep: string;
        recurrenceInterval: number | null;
        recurrenceUnit: "day" | "week" | "month" | null;
        isPriority: boolean;
      }>;
    };

    const patch = body.patch || {};

    // Un cuerpo sin `patch` reconocible se rechaza en vez de responder ok
    // habiendo cambiado nada. Esta API ya tuvo una vez el bug de afirmar
    // escrituras que nunca ocurrieron, y un 200 sobre un no-op es justo esa
    // forma: quien llama se lo cree y nadie se entera hasta que falta el dato.
    // Ningún cliente legítimo manda vacío — tasks-mcp y la web lo comprueban
    // antes de enviar.
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "missing_patch" },
        { status: 400 }
      );
    }

    const existing = await getDbTaskByIdForUser(id, user.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const merged = {
      toDo: patch.toDo !== undefined ? String(patch.toDo).trim() : existing.toDo,
      statusFinalOutcome:
        patch.statusFinalOutcome !== undefined
          ? String(patch.statusFinalOutcome).trim()
          : existing.statusFinalOutcome,
      tipo: patch.tipo !== undefined ? String(patch.tipo).trim() : existing.tipo,
      isPriority: patch.isPriority !== undefined ? patch.isPriority === true : existing.isPriority,
      nextStep: patch.nextStep !== undefined ? String(patch.nextStep).trim() : existing.nextStep,
      dueDateNextStep:
        patch.dueDateNextStep !== undefined
          ? normalizeDateInput(String(patch.dueDateNextStep || "")) || existing.dueDateNextStep
          : existing.dueDateNextStep,
      recurrenceInterval:
        patch.recurrenceInterval !== undefined
          ? patch.recurrenceInterval === null
            ? null
            : (() => {
                const parsed = Number(patch.recurrenceInterval);
                return Number.isFinite(parsed) ? Math.max(1, parsed) : existing.recurrenceInterval;
              })()
          : existing.recurrenceInterval,
      recurrenceUnit:
        patch.recurrenceUnit !== undefined
          ? patch.recurrenceUnit === "day" || patch.recurrenceUnit === "week" || patch.recurrenceUnit === "month"
            ? patch.recurrenceUnit
            : null
          : existing.recurrenceUnit
    };

    merged.toDo = merged.toDo || existing.toDo;
    merged.statusFinalOutcome = merged.statusFinalOutcome || existing.statusFinalOutcome;
    merged.tipo = merged.tipo || existing.tipo;

    const statusNextStep = computeStatusNextStep(merged.dueDateNextStep, merged.statusFinalOutcome);

    const updated = await updateDbTaskForUser(id, user.id, { ...merged, statusNextStep });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    const becameDone =
      existing.statusFinalOutcome !== "Done" && merged.statusFinalOutcome === "Done";
    if (becameDone && merged.recurrenceInterval && merged.recurrenceUnit) {
      const nextDueDate = addRecurringInterval(
        merged.dueDateNextStep,
        merged.recurrenceInterval,
        merged.recurrenceUnit
      );
      await createDbTaskForUser(user.id, {
        toDo: merged.toDo,
        statusFinalOutcome: "To-do",
        tipo: merged.tipo,
        nextStep: merged.nextStep,
        dueDateNextStep: nextDueDate,
        statusNextStep: computeStatusNextStep(nextDueDate, "To-do"),
        recurrenceInterval: merged.recurrenceInterval,
        recurrenceUnit: merged.recurrenceUnit
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // El detalle va al log del servidor: el mensaje de `pg` trae SQL y columnas.
    console.warn("[tasks/[id]]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}
