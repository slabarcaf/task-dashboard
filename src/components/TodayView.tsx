"use client";

import { TaskCard } from "@/components/TaskCard";
import { EmptyState, TaskSection } from "@/components/TaskSection";
import { AppLanguage } from "@/lib/categories";
import { normalizeStatus } from "@/lib/taskFilters";
import { Task } from "@/lib/types";

export type TaskActions = {
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMoveTomorrow: (task: Task) => void;
  onTogglePriority: (task: Task) => void;
  onDelete: (task: Task) => void;
};

type TodayViewProps = TaskActions & {
  tasks: Task[];
  today: string;
  weekEnd: string;
  language: AppLanguage;
  pendingRows: Record<number, boolean>;
};

/**
 * The default screen: what is late, what is due today, what is coming.
 *
 * Same shape and same order as the 7:00 brief on Telegram, on purpose. If the
 * two disagree about what "today" means, the person has to hold two mental
 * models of one product.
 */
export function TodayView({
  tasks,
  today,
  weekEnd,
  language,
  pendingRows,
  ...actions
}: TodayViewProps) {
  const open = tasks.filter((task) => normalizeStatus(task.statusFinalOutcome) !== "Done");
  const done = tasks.filter((task) => normalizeStatus(task.statusFinalOutcome) === "Done");

  const overdue = open.filter((t) => t.dueDateNextStep && t.dueDateNextStep < today);
  const dueToday = open.filter((t) => t.dueDateNextStep === today);
  const thisWeek = open.filter(
    (t) => t.dueDateNextStep > today && t.dueDateNextStep <= weekEnd
  );
  const later = open.filter((t) => t.dueDateNextStep && t.dueDateNextStep > weekEnd);
  const noDate = open.filter((t) => !t.dueDateNextStep);

  type Group = { key: string; title: string; rows: Task[]; tone?: "late" | "today" };
  const groups: Group[] = ([
    { key: "overdue", title: "Vencidas", rows: overdue, tone: "late" },
    { key: "today", title: "Hoy", rows: dueToday, tone: "today" },
    { key: "week", title: "Esta semana", rows: thisWeek },
    { key: "later", title: "Más adelante", rows: later },
    { key: "no_date", title: "Sin fecha", rows: noDate },
    { key: "done", title: "Ya está", rows: done }
  ] as Group[]).filter((group) => group.rows.length > 0);

  // The only way every group is empty is that there are no tasks at all — a
  // task that is Done still shows under "Ya está". So this is a first run, and
  // telling someone who has never written a task that "nothing is left" reads
  // like the app lost their data.
  if (groups.length === 0) {
    return (
      <EmptyState
        icon="✍️"
        title="Todavía no hay nada aquí"
        hint="Escribe tu primera tarea arriba. Puedes decir la fecha en la misma frase: “pagar la luz el viernes”."
      />
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <TaskSection key={group.key} title={group.title} count={group.rows.length} tone={group.tone}>
          {group.rows.map((task) => (
            <TaskCard
              key={task.rowId}
              task={task}
              today={today}
              language={language}
              isPending={Boolean(pendingRows[task.rowId])}
              {...actions}
            />
          ))}
        </TaskSection>
      ))}
    </div>
  );
}
