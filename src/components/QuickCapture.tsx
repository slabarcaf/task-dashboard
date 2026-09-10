"use client";

import { FormEvent, forwardRef, useMemo, useState } from "react";
import { categoryLabel, AppLanguage } from "@/lib/categories";
import { formatShortDate } from "@/lib/date";
import { parseTaskInput } from "@/lib/parseTaskInput";

type QuickCaptureProps = {
  today: string;
  language: AppLanguage;
  categories: string[];
  defaultCategory: string;
  disabled?: boolean;
  onAdd: (input: { title: string; dueDate: string; tipo: string }) => Promise<void> | void;
};

/**
 * One line, one task.
 *
 * Types the way you would tell a person: "pagar la luz el viernes". The date
 * phrase is read out of the sentence and shown back before you commit, so the
 * parser is never guessing on your behalf without saying so — and the category
 * stays an explicit choice, because the bot refuses uncategorised tasks and the
 * web silently defaulting was how two vocabularies ended up in one database.
 */
export const QuickCapture = forwardRef<HTMLInputElement, QuickCaptureProps>(function QuickCapture(
  { today, language, categories, defaultCategory, disabled, onAdd },
  ref
) {
  const [text, setText] = useState("");
  const [tipo, setTipo] = useState(defaultCategory);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseTaskInput(text, today), [text, today]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const title = parsed.title.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onAdd({ title, dueDate: parsed.dueDate || today, tipo });
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-panel border border-line bg-surface px-3 py-2 shadow-card focus-within:border-brand/50 sm:gap-2 sm:py-2.5"
    >
      <span aria-hidden className="grid h-6 w-6 flex-none place-items-center text-lg text-ink-3">
        +
      </span>
      <input
        ref={ref}
        value={text}
        disabled={disabled || busy}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribe una tarea… prueba “pagar la luz el viernes”"
        autoComplete="off"
        aria-label="Nueva tarea"
        className="min-w-[12rem] flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />

      {parsed.dueDate && parsed.matchedText && (
        <span className="num rounded-chip border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-brand">
          {formatShortDate(parsed.dueDate, language)}
        </span>
      )}

      <select
        value={tipo}
        onChange={(event) => setTipo(event.target.value)}
        aria-label="Categoría"
        className="min-w-0 rounded-field border border-line bg-sunken px-2 py-1 text-[12.5px] font-semibold text-ink-2 outline-none"
      >
        {categories.map((option) => (
          <option key={option} value={option}>
            {categoryLabel(option, language)}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={!parsed.title.trim() || busy || disabled}
        className="ml-auto rounded-field bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:ml-0"
      >
        {busy ? "…" : "Agregar"}
      </button>
    </form>
  );
});
