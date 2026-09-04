import { todayIsoDate } from "@/lib/date";
import { AddTaskPayload, Task, TaskPatch } from "@/lib/types";

/**
 * The pure helpers that used to sit at the top of `page.tsx`: shaping form
 * values, normalising what the user typed, searching and bucketing. Nothing
 * here touches React or the network, so it is safe to import from anywhere and
 * cheap to test.
 */

export type CanvasColumnId = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "no_due";
export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "custom";

export function defaultFormValues(tipo = "Otros"): AddTaskPayload {
  return {
    toDo: "",
    statusFinalOutcome: "To-do",
    tipo,
    nextStep: "",
    dueDateNextStep: todayIsoDate(),
    statusNextStep: "",
    recurrenceInterval: null,
    recurrenceUnit: null
  };
}

/** Trims, drops blanks, and removes case-insensitive duplicates in order. */
export function normalizeTipoOptions(options: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of options) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

/** Accepts what a Spanish keyboard produces (dd-mm-yyyy) besides ISO. */
export function normalizeDateInput(value: string): string {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ddmmyyyy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

export function normalizeTaskPatch(patch: TaskPatch): TaskPatch {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as TaskPatch;
}

/** One historical spelling of the same status still lives in old rows. */
export function normalizeStatus(status: string): string {
  if (status === "On-hold") return "On hold";
  return status;
}

export function taskSearchText(task: Task): string {
  return [
    task.toDo,
    task.nextStep,
    task.statusNextStep,
    task.tipo,
    normalizeStatus(task.statusFinalOutcome),
    task.dueDateNextStep
  ]
    .join(" ")
    .toLowerCase();
}

export function getSuggestionScore(query: string, text: string): number {
  if (!query) return 0;
  if (text.includes(query)) return 1000;

  const queryTokens = query.split(/\s+/).filter(Boolean);
  const textTokens = new Set(text.split(/\s+/).filter(Boolean));

  let score = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      score += 5;
    } else if (text.includes(token)) {
      score += 2;
    }
  }

  if (text.startsWith(query)) score += 3;
  return score;
}

export function taskFromPayload(rowId: number, payload: AddTaskPayload): Task {
  return {
    rowId,
    ...payload,
    isPriority: payload.isPriority === true
  };
}

export function recurrencePresetFromTask(
  task: Pick<Task, "recurrenceInterval" | "recurrenceUnit">
): RecurrencePreset {
  if (!task.recurrenceInterval || !task.recurrenceUnit) return "none";
  if (task.recurrenceInterval === 1 && task.recurrenceUnit === "day") return "daily";
  if (task.recurrenceInterval === 1 && task.recurrenceUnit === "week") return "weekly";
  if (task.recurrenceInterval === 1 && task.recurrenceUnit === "month") return "monthly";
  return "custom";
}

export function getCanvasColumnId(
  task: Task,
  today: string,
  tomorrow: string,
  weekEnd: string
): CanvasColumnId {
  const due = task.dueDateNextStep;
  if (!due) return "no_due";
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === tomorrow) return "tomorrow";
  if (due <= weekEnd) return "this_week";
  return "later";
}
