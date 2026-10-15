import { createDbTaskForUser, getDbTaskByIdForUser, updateDbTaskForUser, type DbTask } from "@/lib/server/db";
import { computeStatusNextStep } from "@/lib/server/status";

/**
 * Las reglas de escritura de tareas, en un solo lugar.
 *
 * Vivían dentro de `api/tasks/route.ts` y `api/tasks/[id]/route.ts`. Con una
 * tercera puerta (el conector de Muse) copiarlas habría sido la forma clásica de
 * que una tarea recurrente se renueve desde la web y no desde Muse.
 */

export type RecurrenceUnit = "day" | "week" | "month";

export type TaskCreateInput = {
  toDo?: string;
  statusFinalOutcome?: string;
  tipo?: string;
  nextStep?: string;
  dueDateNextStep?: string;
  recurrenceInterval?: number | null;
  recurrenceUnit?: RecurrenceUnit | null;
  isPriority?: boolean;
};

export type TaskPatch = Partial<{
  toDo: string;
  statusFinalOutcome: string;
  tipo: string;
  nextStep: string;
  dueDateNextStep: string;
  recurrenceInterval: number | null;
  recurrenceUnit: RecurrenceUnit | null;
  isPriority: boolean;
}>;

export function normalizeDateInput(value: string): string | null {
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

export function addRecurringInterval(dueDateIso: string, interval: number, unit: RecurrenceUnit): string {
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

function isUnit(value: unknown): value is RecurrenceUnit {
  return value === "day" || value === "week" || value === "month";
}

export type CreateResult = { ok: true; rowId: number } | { ok: false; error: "missing_fields" };

export async function createTaskForUser(userId: number, body: TaskCreateInput): Promise<CreateResult> {
  const toDo = String(body.toDo || "").trim();
  const statusFinalOutcome = String(body.statusFinalOutcome || "To-do").trim();
  const tipo = String(body.tipo || "Otros").trim();
  const nextStep = String(body.nextStep || "").trim();
  const dueDateNextStep = normalizeDateInput(String(body.dueDateNextStep || ""));
  const parsedRecurrence = Number(body.recurrenceInterval);
  const recurrenceInterval =
    body.recurrenceInterval === null || body.recurrenceInterval === undefined
      ? null
      : Number.isFinite(parsedRecurrence)
        ? Math.max(1, parsedRecurrence)
        : null;
  const recurrenceUnit = isUnit(body.recurrenceUnit) ? body.recurrenceUnit : null;

  if (!toDo || !dueDateNextStep) return { ok: false, error: "missing_fields" };

  const rowId = await createDbTaskForUser(userId, {
    toDo,
    statusFinalOutcome,
    tipo,
    nextStep,
    dueDateNextStep,
    statusNextStep: computeStatusNextStep(dueDateNextStep, statusFinalOutcome),
    recurrenceInterval: recurrenceUnit ? recurrenceInterval || 1 : null,
    recurrenceUnit,
    isPriority: body.isPriority === true
  });
  return { ok: true, rowId };
}

export type PatchResult =
  | { ok: true; before: DbTask; task: DbTask; nextOccurrenceId: number | null }
  | { ok: false; error: "not_found" };

/**
 * Aplica un patch y, si una tarea recurrente pasa a Done, crea la siguiente.
 * Devuelve la fila tal como quedó en la base, no un "ok" — quien llama puede
 * mostrar lo que de verdad pasó.
 */
export async function patchTaskForUser(userId: number, id: number, patch: TaskPatch): Promise<PatchResult> {
  const existing = await getDbTaskByIdForUser(id, userId);
  if (!existing) return { ok: false, error: "not_found" };

  const merged = {
    toDo: patch.toDo !== undefined ? String(patch.toDo).trim() : existing.toDo,
    statusFinalOutcome:
      patch.statusFinalOutcome !== undefined ? String(patch.statusFinalOutcome).trim() : existing.statusFinalOutcome,
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
        ? isUnit(patch.recurrenceUnit)
          ? patch.recurrenceUnit
          : null
        : existing.recurrenceUnit
  };

  merged.toDo = merged.toDo || existing.toDo;
  merged.statusFinalOutcome = merged.statusFinalOutcome || existing.statusFinalOutcome;
  merged.tipo = merged.tipo || existing.tipo;

  const statusNextStep = computeStatusNextStep(merged.dueDateNextStep, merged.statusFinalOutcome);
  const updated = await updateDbTaskForUser(id, userId, { ...merged, statusNextStep });
  if (!updated) return { ok: false, error: "not_found" };

  let nextOccurrenceId: number | null = null;
  const becameDone = existing.statusFinalOutcome !== "Done" && merged.statusFinalOutcome === "Done";
  if (becameDone && merged.recurrenceInterval && merged.recurrenceUnit) {
    const nextDueDate = addRecurringInterval(merged.dueDateNextStep, merged.recurrenceInterval, merged.recurrenceUnit);
    nextOccurrenceId = await createDbTaskForUser(userId, {
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

  // Se vuelve a leer: lo que se devuelve es lo que quedó escrito, no lo que se pidió.
  const task = (await getDbTaskByIdForUser(id, userId)) ?? { ...existing, ...merged, statusNextStep };
  return { ok: true, before: existing, task, nextOccurrenceId };
}
