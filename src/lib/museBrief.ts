/**
 * Lo que el feed matutino de Muse necesita saber, calculado aquí y no por el
 * modelo de Muse.
 *
 * Es la misma lección del guard de "ya lo hice" en el bot: lo que puede
 * decidirse en código no se le deja a un LLM. "¿Qué está vencido?" es una
 * comparación de fechas, y en la zona de la persona — no en UTC, que es la hora
 * de Vercel y la que haría que a las 17:00 de California todo pareciera de
 * mañana (el mismo bug que `dateZone.test.mjs` ya clavó una vez).
 *
 * Sin imports a propósito: así la prueba lo carga con esbuild sin base de datos.
 */

export type BriefTask = {
  rowId: number;
  toDo: string;
  statusFinalOutcome: string;
  tipo: string;
  nextStep: string;
  dueDateNextStep: string;
  isPriority: boolean;
};

export type BriefDebt = {
  id: number;
  name: string;
  amount: number;
  currency: string;
  direction: string;
  reason: string;
  status: string;
};

export type Brief = {
  today: string;
  timezone: string;
  overdue: BriefTask[];
  dueToday: BriefTask[];
  priority: BriefTask[];
  upcoming: BriefTask[];
  pendingDebts: { owedByMe: BriefDebt[]; owedToMe: BriefDebt[] };
  counts: { open: number; overdue: number; dueToday: number; pendingDebts: number };
};

/** "YYYY-MM-DD" del día que está viviendo la persona. `en-CA` formatea así. */
export function todayInZone(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
  } catch {
    // Zona inválida guardada en la base: mejor el día de Los Ángeles que un 500.
    return todayInZone("America/Los_Angeles", now);
  }
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Cancelada cuenta como cerrada: nadie quiere que el brief le recuerde algo que descartó. */
export function isOpen(task: Pick<BriefTask, "statusFinalOutcome">): boolean {
  const status = task.statusFinalOutcome.trim().toLowerCase();
  return status !== "done" && !status.startsWith("cancel");
}

export function buildBrief(
  tasks: BriefTask[],
  debts: BriefDebt[],
  timezone: string,
  now: Date = new Date(),
  upcomingDays = 3
): Brief {
  const today = todayInZone(timezone, now);
  const horizon = addDays(today, upcomingDays);
  const open = tasks.filter(isOpen);

  const overdue = open.filter((t) => t.dueDateNextStep && t.dueDateNextStep < today);
  const dueToday = open.filter((t) => t.dueDateNextStep === today);
  // Prioritarias que no salieron ya arriba, para no repetirlas.
  const priority = open.filter((t) => t.isPriority && !(t.dueDateNextStep <= today));
  const upcoming = open.filter(
    (t) => !t.isPriority && t.dueDateNextStep > today && t.dueDateNextStep <= horizon
  );

  const pending = debts.filter((d) => d.status !== "Pagado");
  return {
    today,
    timezone,
    overdue,
    dueToday,
    priority,
    upcoming,
    pendingDebts: {
      owedByMe: pending.filter((d) => d.direction === "Debo yo"),
      owedToMe: pending.filter((d) => d.direction !== "Debo yo")
    },
    counts: {
      open: open.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      pendingDebts: pending.length
    }
  };
}

/** Filtros de `GET /api/muse/tasks?view=`. Los mismos cortes que el brief. */
export type TaskView = "open" | "overdue_and_today" | "all";

export function filterTasks<T extends BriefTask>(
  tasks: T[],
  view: TaskView,
  timezone: string,
  now: Date = new Date()
): T[] {
  if (view === "all") return tasks;
  const open = tasks.filter(isOpen);
  if (view === "open") return open;
  const today = todayInZone(timezone, now);
  return open.filter((t) => t.dueDateNextStep && t.dueDateNextStep <= today);
}

export function parseTaskView(value: string | null): TaskView {
  return value === "all" || value === "overdue_and_today" ? value : "open";
}
