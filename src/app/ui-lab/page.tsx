"use client";

import { useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { Wordmark } from "@/components/SignInScreen";
import { addDaysToIsoDate, todayIsoDate } from "@/lib/date";
import { Task } from "@/lib/types";

/**
 * A workbench for the presentational components — the Storybook the plan judged
 * too expensive, in one file.
 *
 * It exists because the whole redesigned surface lives behind a Google sign-in
 * that only Santiago can pass, and redrawing it blind is the riskiest thing in
 * the plan. Nothing here touches the database, the session or the API: it hands
 * fixed rows to components that take rows as props. Deleting this file would
 * cost the app no behaviour at all.
 */

const today = todayIsoDate();

function fixture(rowId: number, toDo: string, over: Partial<Task> = {}): Task {
  return {
    rowId,
    toDo,
    statusFinalOutcome: "To-do",
    tipo: "Otros",
    nextStep: "",
    dueDateNextStep: today,
    statusNextStep: "",
    recurrenceInterval: null,
    recurrenceUnit: null,
    isPriority: false,
    ...over
  };
}

const SAMPLES: Task[] = [
  fixture(1, "Firmar rental agreement", {
    tipo: "Personal",
    dueDateNextStep: addDaysToIsoDate(today, -5),
    isPriority: true
  }),
  fixture(2, "Entregar llaves a Fernando", {
    tipo: "Personal",
    dueDateNextStep: addDaysToIsoDate(today, -3)
  }),
  fixture(3, "Sacar ikon pass de correo", { tipo: "Finanzas", isPriority: true }),
  fixture(4, "Revisar CV de Bela", {
    tipo: "Networking",
    nextStep: "Mandarle los comentarios por correo"
  }),
  fixture(5, "Contratar clases de golf", { tipo: "Golf club" }),
  fixture(6, "Comprar maleta para el viaje", {
    tipo: "Personal",
    statusFinalOutcome: "Done",
    dueDateNextStep: addDaysToIsoDate(today, -1)
  }),
  fixture(7, "Hacer el research de zapatillas", {
    tipo: "Otros",
    dueDateNextStep: addDaysToIsoDate(today, 10)
  })
];

export default function UiLabPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lastAction, setLastAction] = useState("—");

  const setThemeAttr = (next: "light" | "dark") => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };

  const noop = (label: string) => (task: Task) => setLastAction(`${label} → #${task.rowId}`);

  const handlers = {
    today,
    language: "es" as const,
    onToggleDone: noop("hecha"),
    onEdit: noop("editar"),
    onMoveTomorrow: noop("mañana"),
    onTogglePriority: noop("prioridad"),
    onDelete: noop("eliminar")
  };

  return (
    <main className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center gap-4 border-b border-line pb-6">
          <Wordmark />
          <span className="rounded-chip border border-line bg-sunken px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            ui lab
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setThemeAttr(theme === "dark" ? "light" : "dark")}
              className="rounded-field border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:border-line-2 hover:text-ink"
            >
              {theme === "dark" ? "☀ Claro" : "☾ Oscuro"}
            </button>
          </div>
        </header>

        <p className="mb-8 max-w-2xl text-sm text-ink-2">
          Datos falsos, sin base de datos ni sesión. Sirve para revisar los componentes sin entrar a
          la cuenta. Última acción: <b className="text-ink">{lastAction}</b>
        </p>

        <Section title="Vencidas" count={2} tone="late">
          {SAMPLES.slice(0, 2).map((task) => (
            <TaskCard key={task.rowId} task={task} {...handlers} />
          ))}
        </Section>

        <Section title="Hoy" count={3}>
          {SAMPLES.slice(2, 5).map((task) => (
            <TaskCard key={task.rowId} task={task} {...handlers} />
          ))}
        </Section>

        <Section title="Ya está" count={1}>
          <TaskCard task={SAMPLES[5]} {...handlers} />
        </Section>

        <Section title="Estados especiales" count={2}>
          <TaskCard task={SAMPLES[6]} {...handlers} isPending />
          <TaskCard
            task={fixture(8, "Una tarea con un título muy largo que tiene que envolver sin romper la tarjeta ni empujar los botones fuera de su sitio")}
            {...handlers}
          />
        </Section>

        <div className="mt-10">
          <h2 className="mb-3 font-display text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-3">
            Densidad de tablero
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {["Vencidas", "Hoy", "Mañana"].map((label, index) => (
              <div
                key={label}
                className={
                  index === 1
                    ? "flex w-[258px] flex-none flex-col gap-2 rounded-panel border border-brand/30 bg-brand-soft p-3"
                    : "flex w-[258px] flex-none flex-col gap-2 rounded-panel border border-line bg-sunken p-3"
                }
              >
                <div className="flex items-center gap-2 px-1 pb-1">
                  <b className="font-display text-[12.5px] font-semibold tracking-wide text-ink">
                    {label}
                  </b>
                  <span className="num ml-auto text-[11.5px] font-bold text-ink-3">
                    {index === 0 ? 2 : index === 1 ? 3 : 1}
                  </span>
                </div>
                {SAMPLES.slice(index * 2, index * 2 + (index === 2 ? 1 : 2)).map((task) => (
                  <TaskCard key={task.rowId} task={task} density="board" {...handlers} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  count,
  tone,
  children
}: {
  title: string;
  count: number;
  tone?: "late";
  children: React.ReactNode;
}) {
  const late = tone === "late";
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2.5">
        <h3
          className={`font-display text-[12.5px] font-bold uppercase tracking-[0.11em] ${
            late ? "text-late" : "text-ink-3"
          }`}
        >
          {title}
        </h3>
        <span
          className={`num rounded-chip border px-2 py-px text-[11.5px] font-bold ${
            late ? "border-late/30 bg-late-soft text-late" : "border-line bg-sunken text-ink-3"
          }`}
        >
          {count}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
