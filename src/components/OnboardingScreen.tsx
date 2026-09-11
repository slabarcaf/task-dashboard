"use client";

import { useMemo, useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { Wordmark } from "@/components/SignInScreen";
import { AppLanguage, CANONICAL_CATEGORIES, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { todayIsoDate } from "@/lib/date";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { normalizeTipoOptions } from "@/lib/taskFilters";
import { Task } from "@/lib/types";

export type OnboardingAnswers = {
  categories: string[];
  timezone: string;
  briefMorning: string;
  briefEvening: string;
  firstTask: { title: string; dueDate: string; tipo: string } | null;
};

type OnboardingScreenProps = {
  language: AppLanguage;
  initialSelection: string[];
  isSaving: boolean;
  error: string | null;
  onComplete: (answers: OnboardingAnswers) => void;
};

const STEPS = ["Categorías", "Horarios", "Tu primera tarea", "Listo"];

const TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Mexico_City", "America/Bogota", "America/Santiago", "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires", "Europe/Madrid", "Europe/London", "Europe/Berlin",
  "Asia/Tokyo", "Australia/Sydney", "UTC"
];

/**
 * Cuatro preguntas y una demostración.
 *
 * La tercera pantalla no es un tutorial: la tarea que escriben ahí **se guarda
 * de verdad**, y es la primera que ven al entrar. Enseñar con un ejemplo falso
 * que después desaparece obliga a hacer el trabajo dos veces, y la primera vez
 * no cuenta.
 *
 * Todo se guarda al final, en una sola escritura. Guardar por paso haría que
 * quien abandone a mitad quede con la mitad configurada y sin onboarding
 * pendiente — mitad dentro y mitad fuera es el peor de los dos estados.
 */
export function OnboardingScreen({
  language,
  initialSelection,
  isSaving,
  error,
  onComplete
}: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [custom, setCustom] = useState("");

  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
    } catch {
      return "America/Los_Angeles";
    }
  });
  const [morning, setMorning] = useState("07:00");
  const [evening, setEvening] = useState("20:00");
  const [wantsMorning, setWantsMorning] = useState(true);
  const [wantsEvening, setWantsEvening] = useState(true);

  const [taskText, setTaskText] = useState("");
  const [taskTipo, setTaskTipo] = useState("");

  const today = todayIsoDate();
  const finalCategories = normalizeTipoOptions([...selected, custom.trim()]);
  const parsed = useMemo(() => parseTaskInput(taskText, today), [taskText, today]);
  const chosenTipo = taskTipo || finalCategories[0] || "Otros";

  const previewTask: Task = {
    rowId: -1,
    toDo: parsed.title || "…",
    statusFinalOutcome: "To-do",
    tipo: chosenTipo,
    nextStep: "",
    dueDateNextStep: parsed.dueDate || today,
    statusNextStep: "",
    recurrenceInterval: null,
    recurrenceUnit: null,
    isPriority: false
  };

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

  const finish = () =>
    onComplete({
      categories: finalCategories,
      timezone,
      briefMorning: wantsMorning ? morning : "",
      briefEvening: wantsEvening ? evening : "",
      firstTask: parsed.title.trim()
        ? { title: parsed.title.trim(), dueDate: parsed.dueDate || today, tipo: chosenTipo }
        : null
    });

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <Wordmark />
        </div>

        <ol className="mb-4 flex items-center justify-center gap-1.5" aria-label="Progreso">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              title={label}
              className={cn(
                "h-1.5 rounded-chip transition-all",
                index === step ? "w-7 bg-brand" : index < step ? "w-4 bg-brand/40" : "w-4 bg-line"
              )}
            />
          ))}
        </ol>

        <div className="rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
          {step === 0 && (
            <>
              <Head
                title="¿En qué partes se divide tu vida?"
                hint="Elige las que uses de verdad. Sirven para agrupar tus tareas y puedes cambiarlas cuando quieras."
              />
              <div className="flex flex-wrap gap-2">
                {CANONICAL_CATEGORIES.map((category) => {
                  const active = selected.some((i) => i.toLowerCase() === category.toLowerCase());
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
                  className={inputClass}
                />
                <button type="button" onClick={addCustom} className={ghostClass}>
                  Agregar
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Head
                title="¿Cuándo quieres que te escriba?"
                hint="Sydney te manda dos mensajes al día por Telegram: en la mañana lo que viene, en la noche lo que quedó. Puedes apagar cualquiera de los dos."
              />
              <label className="mb-5 block">
                <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                  Tu zona horaria
                </span>
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className={inputClass}
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <span className="num mt-1.5 block text-[12.5px] text-ink-3">
                  Ahí son las {nowIn(timezone)} ahora mismo.
                </span>
              </label>

              <BriefToggle
                label="☀ En la mañana"
                enabled={wantsMorning}
                value={morning}
                onToggle={setWantsMorning}
                onChange={setMorning}
              />
              <BriefToggle
                label="☾ En la noche"
                enabled={wantsEvening}
                value={evening}
                onToggle={setWantsEvening}
                onChange={setEvening}
              />
              {!wantsMorning && !wantsEvening && (
                <p className="mt-3 rounded-card border border-amber/30 bg-amber-soft px-3 py-2 text-[12.5px] text-amber-ink">
                  Sin ninguno de los dos, Sydney no te va a escribir sola. Puedes seguir y
                  encenderlos después en Ajustes.
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Head
                title="Escribe tu primera tarea"
                hint="Como se la dirías a una persona. Si mencionas cuándo, la fecha se entiende sola — prueba con “el viernes” o “en 3 días”."
              />
              <input
                autoFocus
                value={taskText}
                onChange={(event) => setTaskText(event.target.value)}
                placeholder="pagar la luz el viernes"
                className={inputClass}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-ink-3">Categoría:</span>
                {finalCategories.slice(0, 6).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTaskTipo(option)}
                    aria-pressed={chosenTipo === option}
                    className={cn(
                      "rounded-chip border px-2.5 py-0.5 text-[12px] font-semibold transition-colors",
                      chosenTipo === option
                        ? "border-brand/40 bg-brand-soft text-brand"
                        : "border-line text-ink-3 hover:text-ink-2"
                    )}
                  >
                    {categoryLabel(option, language)}
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                Así se va a ver
              </p>
              <div className={cn("transition-opacity", !parsed.title.trim() && "opacity-45")}>
                <TaskCard
                  task={previewTask}
                  today={today}
                  language={language}
                  onToggleDone={() => {}}
                  onEdit={() => {}}
                  onMoveTomorrow={() => {}}
                  onTogglePriority={() => {}}
                  onDelete={() => {}}
                />
              </div>
              <p className="mt-3 text-[12.5px] text-ink-3">
                {parsed.matchedText
                  ? `Leí “${parsed.matchedText}” como la fecha. El resto queda de título.`
                  : "Sin fecha en la frase queda para hoy. Puedes cambiarla después."}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <Head
                title="Eso es todo"
                hint="Tus tareas y tus deudas viven en los dos lados a la vez: aquí en la web y en el chat de Telegram."
              />
              <ul className="space-y-2.5">
                <Bullet icon="✓">
                  Lo que anotes aquí aparece en Telegram, y lo que le digas a Sydney por Telegram
                  aparece aquí. Es la misma cuenta.
                </Bullet>
                <Bullet icon="✓">
                  Tareas y deudas: quién te debe, a quién le debes, y en qué quedó.
                </Bullet>
                <Bullet icon="✈">
                  <b className="text-ink">Falta conectar Telegram.</b> Sin eso no llegan tus
                  mensajes del día ni puedes escribirle. Se hace en Ajustes, en un minuto.
                </Bullet>
              </ul>
              <div className="mt-5 rounded-card border border-line bg-raised px-4 py-3 text-[13px] text-ink-2">
                Vas a entrar
                {parsed.title.trim() ? " con tu primera tarea ya anotada" : ""}
                {finalCategories.length > 0 && `, con ${finalCategories.length} categorías`}
                {wantsMorning || wantsEvening
                  ? ` y con tus mensajes ${wantsMorning && wantsEvening ? "de la mañana y la noche" : wantsMorning ? "de la mañana" : "de la noche"} listos.`
                  : "."}
              </div>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-card border border-late/30 bg-late-soft px-3 py-2 text-sm text-late">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || isSaving}
              className="rounded-field px-2 py-2 text-sm text-ink-3 hover:text-ink disabled:invisible"
            >
              ← Atrás
            </button>

            <span className="num text-[12.5px] text-ink-3">
              {step + 1} de {STEPS.length}
            </span>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                disabled={step === 0 && finalCategories.length === 0}
                className="rounded-field bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 2 && !parsed.title.trim() ? "Saltar" : "Seguir"}
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={isSaving}
                className="rounded-field bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-40"
              >
                {isSaving ? "Guardando…" : "Entrar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const inputClass =
  "w-full min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60";
const ghostClass =
  "flex-none rounded-field border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-2 hover:text-ink";

function Head({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <h1 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mb-5 mt-1.5 text-sm leading-relaxed text-ink-2">{hint}</p>
    </>
  );
}

function Bullet({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
      <span aria-hidden className="flex-none text-brand">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function BriefToggle({
  label,
  enabled,
  value,
  onToggle,
  onChange
}: {
  label: string;
  enabled: boolean;
  value: string;
  onToggle: (enabled: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-3 rounded-card border border-line px-3 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={() => onToggle(!enabled)}
        className={cn(
          "h-5 w-9 flex-none rounded-chip p-0.5 transition-colors",
          enabled ? "bg-brand" : "bg-line-2"
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-white transition-transform",
            enabled && "translate-x-4"
          )}
        />
      </button>
      <span className="flex-1 text-sm text-ink">{label}</span>
      <input
        type="time"
        value={value}
        disabled={!enabled}
        onChange={(event) => onChange(event.target.value)}
        className="num rounded-field border border-line bg-surface px-2 py-1 text-sm text-ink outline-none disabled:opacity-40"
      />
    </div>
  );
}

function nowIn(timeZone: string): string {
  try {
    return new Date().toLocaleTimeString("es-CL", { timeZone, hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}
