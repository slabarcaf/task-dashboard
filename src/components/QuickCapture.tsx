"use client";

import { FormEvent, forwardRef, useMemo, useState } from "react";
import { categoryLabel, AppLanguage } from "@/lib/categories";
import { formatShortDate } from "@/lib/date";
import { cn } from "@/lib/cn";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { VoiceButton } from "@/components/VoiceButton";

type QuickCaptureProps = {
  today: string;
  language: AppLanguage;
  categories: string[];
  defaultCategory: string;
  disabled?: boolean;
  onVoiceError: (message: string) => void;
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
  { today, language, categories, defaultCategory, disabled, onVoiceError, onAdd },
  ref
) {
  const [text, setText] = useState("");
  const [manualTipo, setManualTipo] = useState(defaultCategory);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(
    () => parseTaskInput(text, today, categories),
    [text, today, categories]
  );

  // Si la frase nombra una categoría, manda ella. Se recalcula en cada tecla,
  // así que no hace falta esperar ni refrescar nada: el selector va siguiendo lo
  // que se escribe. La elección manual gana sobre lo dictado sólo mientras el
  // texto no vuelva a nombrar otra.
  const tipo = parsed.tipo || manualTipo;

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

      {/* La transcripción entra al campo, no crea la tarea: quien dictó tiene que
          poder leer lo que se entendió antes de que se convierta en algo. */}
      <VoiceButton
        disabled={disabled || busy}
        onError={onVoiceError}
        onTranscript={(text) =>
          setText((current) => (current.trim() ? `${current.trim()} ${text}` : text))
        }
      />

      {parsed.dueDate && parsed.matchedText && (
        <span className="num rounded-chip border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-brand">
          {formatShortDate(parsed.dueDate, language)}
        </span>
      )}

      <select
        value={tipo}
        onChange={(event) => setManualTipo(event.target.value)}
        aria-label="Categoría"
        title={parsed.tipo ? `Leí “${parsed.tipoMatchedText}” en lo que escribiste` : undefined}
        className={cn(
          "min-w-0 rounded-field border px-2 py-1 text-[12.5px] font-semibold outline-none",
          parsed.tipo
            ? "border-brand/40 bg-brand-soft text-brand"
            : "border-line bg-sunken text-ink-2"
        )}
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
