"use client";

import { AppLanguage, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { daysBetweenIsoDates, formatShortDate, relativeDueLabel } from "@/lib/date";
import { normalizeStatus } from "@/lib/taskFilters";
import { Task } from "@/lib/types";

export type TaskCardDensity = "list" | "board";

type TaskCardProps = {
  task: Task;
  today: string;
  language: AppLanguage;
  density?: TaskCardDensity;
  isPending?: boolean;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMoveTomorrow: (task: Task) => void;
  onTogglePriority: (task: Task) => void;
  onDelete: (task: Task) => void;
};

/**
 * One card for both the list and the board.
 *
 * There used to be two near-identical blocks of markup, and the board's copy had
 * quietly lost Priority and Delete — the cost of duplicating markup, paid in
 * missing features rather than in bugs. `density` is the only difference now.
 *
 * The actions are hidden until hover *or focus-within*, so they are reachable by
 * keyboard even though they are invisible to the mouse until you get there.
 */
export function TaskCard({
  task,
  today,
  language,
  density = "list",
  isPending = false,
  onToggleDone,
  onEdit,
  onMoveTomorrow,
  onTogglePriority,
  onDelete
}: TaskCardProps) {
  const isDone = normalizeStatus(task.statusFinalOutcome) === "Done";
  const isOverdue = Boolean(task.dueDateNextStep && task.dueDateNextStep < today && !isDone);
  // "Hoy" says everything; "5-Sep · Hoy" says it twice. Anything further out
  // needs the date, and the relative part only earns its place as a nudge.
  const dueText = dueLabel(task.dueDateNextStep, today, language);
  const compact = density === "board";

  return (
    <article
      className={cn(
        "group relative flex items-start gap-3 border border-line bg-surface shadow-card transition-[border-color,transform,opacity] duration-150",
        "hover:-translate-y-px hover:border-line-2 focus-within:border-line-2",
        compact ? "rounded-card py-2.5 pl-3 pr-3" : "rounded-panel py-3 pl-4 pr-4",
        // The left edge carries the one thing worth seeing without reading:
        // late first, then priority. Never both, so the signal stays single.
        isOverdue && "border-l-[3px] border-l-late",
        !isOverdue && task.isPriority && "border-l-[3px] border-l-amber",
        isPending && "pointer-events-none opacity-60"
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? "Marcar como pendiente" : "Marcar como hecha"}
        onClick={() => onToggleDone(task)}
        className={cn(
          "mt-0.5 flex-none rounded-full border-[1.7px] transition-colors",
          compact ? "h-[17px] w-[17px]" : "h-5 w-5",
          isDone ? "border-ok bg-ok" : "border-line-2 bg-surface group-hover:border-ok"
        )}
      />

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "break-words font-medium leading-snug",
            compact ? "text-[13.8px]" : "text-[14.8px]",
            isDone ? "text-ink-3 line-through" : "text-ink"
          )}
        >
          {task.toDo}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {task.isPriority && (
            <span className="rounded-chip bg-amber-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-ink">
              🔥 {language === "en" ? "Priority" : "Prioridad"}
            </span>
          )}
          {task.tipo && (
            <span className="rounded-chip border border-line bg-sunken px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-2">
              {categoryLabel(task.tipo, language)}
            </span>
          )}
          {dueText && (
            <span
              className={cn(
                "num text-[11.5px] font-semibold",
                isOverdue ? "font-bold text-late" : "text-ink-3"
              )}
            >
              {dueText}
            </span>
          )}
        </div>

        {!compact && task.nextStep && (
          <p className="mt-1.5 truncate text-[12.5px] text-ink-3">↳ {task.nextStep}</p>
        )}
      </div>

      {/* Absolutely positioned, not a flex sibling. In the flow these four
          buttons reserved ~120px of every card even at zero opacity, which in a
          258px board column left the title breaking one word per line. */}
      <div className="absolute right-1.5 top-1.5 flex gap-0.5 rounded-field bg-surface/95 opacity-0 shadow-card backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <CardAction label="Editar" onClick={() => onEdit(task)}>✎</CardAction>
        <CardAction label="Mover a mañana" onClick={() => onMoveTomorrow(task)}>→</CardAction>
        <CardAction
          label={task.isPriority ? "Quitar prioridad" : "Marcar prioridad"}
          pressed={task.isPriority}
          onClick={() => onTogglePriority(task)}
        >
          🔥
        </CardAction>
        <CardAction label="Eliminar" onClick={() => onDelete(task)}>🗑</CardAction>
      </div>
    </article>
  );
}

/** "Hoy", "Mañana", "31-Ago · hace 5 días", "15-Sep". Empty when there is no date. */
function dueLabel(iso: string, today: string, language: AppLanguage): string {
  if (!iso) return "";
  const relative = relativeDueLabel(iso, today, language);
  const delta = daysBetweenIsoDates(today, iso);
  if (relative && Math.abs(delta) <= 1) return relative;
  const short = formatShortDate(iso, language);
  return relative ? `${short} · ${relative}` : short;
}

function CardAction({
  label,
  onClick,
  pressed,
  children
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="grid h-[29px] w-[29px] place-items-center rounded-field text-[13.5px] text-ink-3 transition-colors hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
