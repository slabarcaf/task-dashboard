"use client";

import { useEffect, useRef, useState } from "react";
import { useRecurrence } from "@/hooks/useRecurrence";
import { AppLanguage, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { RecurrencePreset, recurrencePresetFromTask } from "@/lib/taskFilters";
import { STATUS_FINAL_OUTCOME_OPTIONS, Task, TaskPatch } from "@/lib/types";

type EditTaskDialogProps = {
  task: Task;
  categories: string[];
  language: AppLanguage;
  isSaving: boolean;
  onClose: () => void;
  onSave: (rowId: number, patch: TaskPatch) => void;
};

const PRESETS: Array<[RecurrencePreset, string]> = [
  ["none", "No se repite"],
  ["daily", "Cada día"],
  ["weekly", "Cada semana"],
  ["monthly", "Cada mes"],
  ["custom", "Personalizado"]
];

/**
 * The full form for one task — everything quick capture deliberately leaves out.
 *
 * It owns its own draft state and is mounted only while open (the caller keys it
 * by row id), so there is no stale form to reset and no "editForm | null" living
 * in the page. Like the command palette it handles focus itself: Escape closes,
 * the backdrop closes, and focus returns where it came from.
 */
export function EditTaskDialog({
  task,
  categories,
  language,
  isSaving,
  onClose,
  onSave
}: EditTaskDialogProps) {
  const [draft, setDraft] = useState<Task>(task);
  const [preset, setPreset] = useState<RecurrencePreset>(() => recurrencePresetFromTask(task));
  const [interval, setInterval] = useState(task.recurrenceInterval || 2);
  const [unit, setUnit] = useState<"day" | "week" | "month">(task.recurrenceUnit || "week");
  const titleRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useRecurrence(preset, interval, unit, (recurrence) =>
    setDraft((current) => ({ ...current, ...recurrence }))
  );

  useEffect(() => {
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    // Direct, not via requestAnimationFrame — see the note in CommandPalette.
    titleRef.current?.focus();
    return () => {
      restoreFocusTo.current?.focus?.();
    };
  }, []);

  const save = () => {
    if (!draft.toDo.trim()) return;
    onSave(task.rowId, {
      toDo: draft.toDo.trim(),
      statusFinalOutcome: draft.statusFinalOutcome,
      tipo: draft.tipo,
      nextStep: draft.nextStep.trim(),
      dueDateNextStep: draft.dueDateNextStep,
      recurrenceInterval: draft.recurrenceUnit ? draft.recurrenceInterval : null,
      recurrenceUnit: draft.recurrenceUnit
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] grid justify-items-center overflow-y-auto bg-night-1/50 p-4 pt-[8vh] backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar tarea"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
          }
        }}
        className="h-fit w-full max-w-[560px] rounded-panel border border-line-2 bg-surface p-5 shadow-float"
      >
        <h2 className="mb-4 font-display text-lg font-semibold text-ink">Editar tarea</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tarea" className="sm:col-span-2">
            <input
              ref={titleRef}
              value={draft.toDo}
              onChange={(event) => setDraft({ ...draft, toDo: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Estado">
            <select
              value={draft.statusFinalOutcome}
              onChange={(event) => setDraft({ ...draft, statusFinalOutcome: event.target.value })}
              className={inputClass}
            >
              {STATUS_FINAL_OUTCOME_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Categoría">
            <select
              value={draft.tipo}
              onChange={(event) => setDraft({ ...draft, tipo: event.target.value })}
              className={inputClass}
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {categoryLabel(option, language)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Siguiente paso" className="sm:col-span-2">
            <input
              value={draft.nextStep}
              onChange={(event) => setDraft({ ...draft, nextStep: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Fecha">
            <input
              type="date"
              value={draft.dueDateNextStep}
              onChange={(event) => setDraft({ ...draft, dueDateNextStep: event.target.value })}
              className={inputClass}
            />
          </Field>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-3">
              Se repite
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPreset(value)}
                  className={cn(
                    "rounded-chip border px-3 py-1 text-[13px] transition-colors",
                    preset === value
                      ? "border-brand/40 bg-brand-soft font-semibold text-brand"
                      : "border-line bg-surface text-ink-2 hover:border-line-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(event) => setInterval(Math.max(1, Number(event.target.value || 1)))}
                  className={inputClass}
                />
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as "day" | "week" | "month")}
                  className={inputClass}
                >
                  <option value="day">días</option>
                  <option value="week">semanas</option>
                  <option value="month">meses</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-field border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-line-2 hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSaving || !draft.toDo.trim()}
            className="rounded-field bg-brand px-4 py-1.5 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-field border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand/60";

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-3">
        {label}
      </span>
      {children}
    </label>
  );
}
