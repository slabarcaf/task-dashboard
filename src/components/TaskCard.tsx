"use client";

import { AppLanguage, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { categoryHue } from "@/lib/categoryColor";
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
  const daysLate = isOverdue ? -daysBetweenIsoDates(today, task.dueDateNextStep) : 0;

  return (
    <article
      className={cn(
        "group relative flex gap-3 border border-line shadow-card transition-[border-color,transform,opacity] duration-150",
        "hover:-translate-y-px hover:border-line-2 focus-within:border-line-2",
        // One row in list density: the meta used to sit *under* the title, so
        // eight tasks did not fit on a screen. Everything that is not the title
        // now lives to its right.
        //
        // ⚠️ Only from `sm` up. On a 375px phone the same row squeezed titles
        // down to "Mand…" and some to nothing at all — horizontal space is the
        // scarce one there, and vertical is free because you scroll anyway.
        compact
          ? "flex-col rounded-card px-3 py-2.5"
          : "flex-col rounded-panel px-3.5 py-2 sm:flex-row sm:items-center",
        // The left edge carries the one thing worth seeing without reading:
        // late first, then priority. Never both, so the signal stays single.
        isOverdue && "border-l-[3px] border-l-late",
        !isOverdue && task.isPriority && "border-l-[3px] border-l-amber",
        // The fill deepens with how long it has been late. See globals.css for
        // why it tops out where it does.
        isOverdue ? overdueFillClass(daysLate) : "bg-surface",
        isPending && "pointer-events-none opacity-60"
      )}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-3", compact && "w-full")}>
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? "Marcar como pendiente" : "Marcar como hecha"}
          onClick={() => onToggleDone(task)}
          className={cn(
            "flex-none rounded-full border-[1.7px] transition-colors",
            compact ? "h-[17px] w-[17px]" : "h-[18px] w-[18px]",
            isDone ? "border-ok bg-ok" : "border-line-2 bg-surface group-hover:border-ok"
          )}
        />

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 font-medium leading-snug",
              compact ? "break-words text-[13.8px]" : "break-words text-[14.5px] sm:truncate",
              isDone ? "text-ink-3 line-through" : "text-ink"
            )}
            title={task.toDo}
          >
            {task.toDo}
          </span>
          {!compact && task.nextStep && (
            <span className="hidden min-w-0 flex-none truncate text-[12.5px] text-ink-3 lg:block lg:max-w-[30%]">
              ↳ {task.nextStep}
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex flex-none items-center gap-2",
          // The right padding reserves room for the hover overlay so it never
          // lands on the date. Not needed while stacked: the meta is on its own
          // line there and the overlay sits above it.
          compact
            ? "mt-1.5 flex-wrap pl-[29px]"
            : "mt-1.5 flex-wrap pl-[30px] sm:mt-0 sm:flex-nowrap sm:pl-0 sm:pr-[124px]"
        )}
      >
        {task.isPriority && (
          <span
            className="rounded-chip bg-amber-soft px-2 py-0.5 text-[11.5px] font-semibold text-amber-ink"
            title={language === "en" ? "Priority" : "Prioridad"}
          >
            🔥
          </span>
        )}
        {task.tipo && (
          <span
            className="cat-chip rounded-chip border px-2.5 py-0.5 text-[11.5px] font-semibold"
            style={{ "--cat-h": categoryHue(task.tipo) } as React.CSSProperties}
          >
            {categoryLabel(task.tipo, language)}
          </span>
        )}
        {dueText && (
          <span
            className={cn(
              "num whitespace-nowrap text-[11.5px] font-semibold",
              isOverdue ? "font-bold text-late" : "text-ink-3"
            )}
          >
            {dueText}
          </span>
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

/**
 * How late is late. Four steps rather than a continuous ramp: at these opacities
 * the eye cannot tell 9 days from 11, and steps make "much later than that one"
 * legible at a glance, which a smooth gradient does not.
 */
function overdueFillClass(daysLate: number): string {
  if (daysLate >= 14) return "late-4";
  if (daysLate >= 7) return "late-3";
  if (daysLate >= 3) return "late-2";
  return "late-1";
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
