"use client";

import { TaskCard } from "@/components/TaskCard";
import { TaskActions } from "@/components/TodayView";
import { AppLanguage } from "@/lib/categories";
import { CanvasColumnId, getCanvasColumnId } from "@/lib/taskFilters";
import { cn } from "@/lib/cn";
import { Task } from "@/lib/types";

const COLUMNS: Array<{ id: CanvasColumnId; label: string; tone?: "late" | "today" }> = [
  { id: "overdue", label: "Vencidas", tone: "late" },
  { id: "today", label: "Hoy", tone: "today" },
  { id: "tomorrow", label: "Mañana" },
  { id: "this_week", label: "Esta semana" },
  { id: "later", label: "Más adelante" },
  { id: "no_due", label: "Sin fecha" }
];

type BoardViewProps = TaskActions & {
  tasks: Task[];
  today: string;
  tomorrow: string;
  weekEnd: string;
  language: AppLanguage;
  pendingRows: Record<number, boolean>;
};

/**
 * The same tasks laid out by when they are due.
 *
 * Scrolls sideways inside its own container — the page itself must never move
 * horizontally, which is what a `min-w-max` row inside `overflow-x-auto` buys.
 */
export function BoardView({
  tasks,
  today,
  tomorrow,
  weekEnd,
  language,
  pendingRows,
  ...actions
}: BoardViewProps) {
  const buckets: Record<CanvasColumnId, Task[]> = {
    overdue: [], today: [], tomorrow: [], this_week: [], later: [], no_due: []
  };
  for (const task of tasks) {
    buckets[getCanvasColumnId(task, today, tomorrow, weekEnd)].push(task);
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max gap-3">
        {COLUMNS.map((column) => {
          const rows = buckets[column.id];
          return (
            <div
              key={column.id}
              className={cn(
                // 264px sobre 375 dejaba una astilla de la columna siguiente que no se
                // lee ni se ignora. 78vw muestra una columna entera y asoma la de al
                // lado lo justo para que se entienda que se desliza.
                "flex w-[78vw] max-w-[300px] flex-none flex-col gap-2 rounded-panel border p-3 sm:w-[264px]",
                column.tone === "today"
                  ? "border-brand/30 bg-brand-soft"
                  : column.tone === "late"
                    ? "border-late/25 bg-late-soft"
                    : "border-line bg-sunken"
              )}
            >
              <div className="flex items-center gap-2 px-1 pb-1">
                <b
                  className={cn(
                    "font-display text-[12.5px] font-semibold tracking-wide",
                    column.tone === "late" ? "text-late" : "text-ink"
                  )}
                >
                  {column.label}
                </b>
                <span className="num ml-auto text-[11.5px] font-bold text-ink-3">{rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-1 py-3 text-center text-[12.5px] text-ink-3">—</p>
              ) : (
                rows.map((task) => (
                  <TaskCard
                    key={task.rowId}
                    task={task}
                    today={today}
                    language={language}
                    density="board"
                    isPending={Boolean(pendingRows[task.rowId])}
                    {...actions}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
