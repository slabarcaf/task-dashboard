"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categoryLabel } from "@/lib/categories";
import { useLanguage, useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/date";
import { getSuggestionScore, normalizeStatus, taskSearchText } from "@/lib/taskFilters";
import { Task } from "@/lib/types";

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  today: string;
  commands: PaletteCommand[];
  onPickTask: (task: Task) => void;
};

const MAX_TASKS = 7;

/**
 * ⌘K: every task and the handful of things you can do, one query away.
 *
 * It handles its own focus rather than going through `Modal`, which has no focus
 * trap, no Escape and no portal (see DESIGN.md). What it needs is narrow —
 * autofocus the input, close on Escape, close on the backdrop, and restore focus
 * to whatever was focused before — so a dependency would cost more than it saves
 * here. `Modal` still deserves a real primitive; this is not it.
 */
export function CommandPalette({
  open,
  onClose,
  tasks,
  today,
  commands,
  onPickTask
}: CommandPaletteProps) {
  const t = useT();
  const language = useLanguage();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setCursor(0);
    // Focused straight from the effect, not from requestAnimationFrame: rAF does
    // not fire in a page that is not compositing frames (a background tab, a
    // hidden preview pane), and the palette would then open unfocused — you press
    // ⌘K, start typing, and the letters land in whatever was focused before.
    inputRef.current?.focus();
    return () => {
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  const normalized = query.trim().toLowerCase();

  const matchedCommands = useMemo(
    () =>
      commands.filter(
        (command) => !normalized || command.label.toLowerCase().includes(normalized)
      ),
    [commands, normalized]
  );

  const matchedTasks = useMemo(() => {
    if (!normalized) {
      return tasks
        .filter((task) => normalizeStatus(task.statusFinalOutcome) !== "Done")
        .slice(0, MAX_TASKS);
    }
    return tasks
      .map((task) => ({ task, score: getSuggestionScore(normalized, taskSearchText(task)) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_TASKS)
      .map((entry) => entry.task);
  }, [tasks, normalized]);

  const rows = useMemo(
    () => [
      ...matchedCommands.map((command) => ({ kind: "command" as const, command })),
      ...matchedTasks.map((task) => ({ kind: "task" as const, task }))
    ],
    [matchedCommands, matchedTasks]
  );

  useEffect(() => {
    setCursor((current) => (current >= rows.length ? 0 : current));
  }, [rows.length]);

  if (!open) return null;

  const activate = (index: number) => {
    const row = rows[index];
    if (!row) return;
    onClose();
    if (row.kind === "command") row.command.run();
    else onPickTask(row.task);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || (event.key === "n" && event.ctrlKey)) {
      event.preventDefault();
      setCursor((current) => (rows.length ? (current + 1) % rows.length : 0));
      return;
    }
    if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
      event.preventDefault();
      setCursor((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      activate(cursor);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid justify-items-center bg-night-1/50 p-4 pt-[14vh] backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.palette.dialogLabel}
        onKeyDown={onKeyDown}
        className="h-fit w-full max-w-[560px] overflow-hidden rounded-panel border border-line-2 bg-surface shadow-float"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <span aria-hidden className="text-ink-3">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.palette.placeholder}
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded border border-line bg-sunken px-1.5 py-px text-[11px] font-semibold text-ink-3">
            esc
          </kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-3">{t.palette.noMatches}</p>
          )}
          {rows.map((row, index) => (
            <button
              key={row.kind === "command" ? `c-${row.command.id}` : `t-${row.task.rowId}`}
              type="button"
              onMouseEnter={() => setCursor(index)}
              onClick={() => activate(index)}
              className={cn(
                "flex w-full items-center gap-3 rounded-field px-3 py-2 text-left text-sm transition-colors",
                index === cursor ? "bg-brand-soft text-ink" : "text-ink-2 hover:bg-raised"
              )}
            >
              {row.kind === "command" ? (
                <>
                  <span className="truncate font-medium">{row.command.label}</span>
                  {row.command.hint && (
                    <span className="ml-auto flex-none text-[12px] text-ink-3">
                      {row.command.hint}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="truncate">{row.task.toDo}</span>
                  <span className="ml-auto flex flex-none items-center gap-2 text-[12px] text-ink-3">
                    <span>{categoryLabel(row.task.tipo || "Otros", language)}</span>
                    {row.task.dueDateNextStep && (
                      <span
                        className={cn(
                          "num",
                          row.task.dueDateNextStep < today && "font-semibold text-late"
                        )}
                      >
                        {formatShortDate(row.task.dueDateNextStep, language)}
                      </span>
                    )}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
