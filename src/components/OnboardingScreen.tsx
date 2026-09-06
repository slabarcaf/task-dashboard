"use client";

import { useState } from "react";
import { Wordmark } from "@/components/SignInScreen";
import { AppLanguage, CANONICAL_CATEGORIES, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { normalizeTipoOptions } from "@/lib/taskFilters";

type OnboardingScreenProps = {
  language: AppLanguage;
  initialSelection: string[];
  isSaving: boolean;
  error: string | null;
  onComplete: (categories: string[]) => void;
};

/**
 * The one question asked before the app opens: what buckets does your life have?
 *
 * The suggested set is the canonical one the bot uses, so a person who answers
 * here and a person who answers in Telegram end up with the same vocabulary.
 * Anything they type themselves is stored exactly as typed and never translated.
 */
export function OnboardingScreen({
  language,
  initialSelection,
  isSaving,
  error,
  onComplete
}: OnboardingScreenProps) {
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [custom, setCustom] = useState("");

  const toggle = (category: string) =>
    setSelected((current) =>
      current.some((item) => item.toLowerCase() === category.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== category.toLowerCase())
        : [...current, category]
    );

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    setCustom("");
    setSelected((current) => normalizeTipoOptions([...current, value]));
  };

  const invented = selected.filter(
    (item) => !CANONICAL_CATEGORIES.some((c) => c.toLowerCase() === item.toLowerCase())
  );
  const finalSelection = normalizeTipoOptions([...selected, custom.trim()]);

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-7 flex justify-center">
          <Wordmark />
        </div>

        <div className="rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
            ¿En qué partes se divide tu vida?
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">
            Elige las que uses de verdad. Sirven para agrupar tus tareas, y puedes cambiarlas cuando
            quieras.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {CANONICAL_CATEGORIES.map((category) => {
              const active = selected.some((item) => item.toLowerCase() === category.toLowerCase());
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggle(category)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-chip border px-3.5 py-1.5 text-sm transition-colors",
                    active
                      ? "border-brand/40 bg-brand-soft font-semibold text-brand"
                      : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink"
                  )}
                >
                  {categoryLabel(category, language)}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustom();
                }
              }}
              placeholder="¿Falta alguna? Escríbela aquí"
              className="min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded-field border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-2 hover:text-ink"
            >
              Agregar
            </button>
          </div>

          {invented.length > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-3">
              Tuyas: {invented.join(", ")} — se guardan tal cual las escribiste.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-card border border-late/30 bg-late-soft px-3 py-2 text-sm text-late">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
            <span className="num text-[13px] text-ink-3">
              {finalSelection.length} seleccionada{finalSelection.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => onComplete(finalSelection)}
              disabled={isSaving || finalSelection.length === 0}
              className="rounded-field bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "Guardando…" : "Entrar"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
