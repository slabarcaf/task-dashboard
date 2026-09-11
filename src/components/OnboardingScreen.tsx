"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { TelegramConnect } from "@/components/TelegramConnect";
import { Wordmark } from "@/components/SignInScreen";
import { AppLanguage, CANONICAL_CATEGORIES, categoryLabel } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { addDaysToIsoDate, todayIsoDate } from "@/lib/date";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { normalizeTipoOptions } from "@/lib/taskFilters";
import { Task } from "@/lib/types";

export type OnboardingAnswers = {
  categories: string[];
  timezone: string;
  briefMorning: string;
  briefEvening: string;
  firstTask: {
    title: string;
    dueDate: string;
    tipo: string;
    isPriority: boolean;
    done: boolean;
  } | null;
  firstDebt: {
    name: string;
    amount: number;
    currency: string;
    direction: "Debo yo" | "Me deben";
    reason: string;
  } | null;
};

type OnboardingScreenProps = {
  language: AppLanguage;
  initialSelection: string[];
  isSaving: boolean;
  error: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onComplete: (answers: OnboardingAnswers) => void;
};

const STEPS = [
  { label: "Categorías", eyebrow: "Cómo se ordena tu vida" },
  { label: "Horarios", eyebrow: "Cuándo te llega el resumen" },
  { label: "Tu primera tarea", eyebrow: "Escríbela como la dirías" },
  { label: "Tu primera deuda", eyebrow: "Quién te debe, a quién le debes" },
  { label: "Listo", eyebrow: "Lo que falta para que funcione" }
];

const TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Mexico_City", "America/Bogota", "America/Santiago", "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires", "Europe/Madrid", "Europe/London", "Europe/Berlin",
  "Asia/Tokyo", "Australia/Sydney", "UTC"
];

const CURRENCIES = ["USD", "CLP", "EUR"];

/**
 * Cinco preguntas y dos demostraciones.
 *
 * Los pasos 3 y 4 no son un tutorial: la tarea y la deuda que escriben ahí **se
 * guardan de verdad**, y son las primeras que ven al entrar. Enseñar con un
 * ejemplo falso que después desaparece obliga a hacer el trabajo dos veces, y la
 * primera vez no cuenta.
 *
 * Todo se guarda al final, en una sola tanda. Guardar por paso haría que quien
 * abandone a mitad quede con la mitad configurada y sin onboarding pendiente —
 * mitad dentro y mitad fuera es el peor de los dos estados.
 *
 * La pantalla ocupa el ancho completo con el mismo panel nocturno de la pantalla
 * de acceso. Antes era una tarjeta de 576px flotando en medio de un monitor
 * vacío: el producto se presentaba a sí mismo en una esquina.
 */
export function OnboardingScreen({
  language,
  initialSelection,
  isSaving,
  error,
  theme,
  onToggleTheme,
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
  const taskInputRef = useRef<HTMLInputElement>(null);

  // Lo que la persona cambió con los botones de la tarjeta. No es decorado: se
  // guarda con la tarea, así que la llama que prendió sigue prendida al entrar.
  const [previewPriority, setPreviewPriority] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [dueOverride, setDueOverride] = useState<string | null>(null);

  // El componente de Telegram avisa en cuanto detecta la vinculación, así que
  // esta pantalla puede cambiar de tono sin recargar ni pedirle nada a nadie.
  const [telegramConnected, setTelegramConnected] = useState(false);

  const [debtName, setDebtName] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtCurrency, setDebtCurrency] = useState("USD");
  const [debtReason, setDebtReason] = useState("");
  const [debtDirection, setDebtDirection] = useState<"Debo yo" | "Me deben">("Me deben");

  const today = todayIsoDate();
  const finalCategories = useMemo(
    () => normalizeTipoOptions([...selected, custom.trim()]),
    [selected, custom]
  );

  // Con la lista de la persona, no sin ella: `parseCategoryIn` solo reconoce
  // categorías que ya existen, así que sin el tercer argumento la detección
  // quedaba muerta **solo aquí** mientras funcionaba en la captura rápida.
  const parsed = useMemo(
    () => parseTaskInput(taskText, today, finalCategories),
    [taskText, today, finalCategories]
  );

  // Si la frase nombra una categoría, manda ella; si no, la que se eligió a mano;
  // y recién al final la primera de la lista. Nunca "Otros" a menos que la tenga.
  const chosenTipo = parsed.tipo || taskTipo || finalCategories[0] || "Otros";
  const baseDue = parsed.dueDate || today;
  const effectiveDue = dueOverride || baseDue;

  // Volver a escribir la fecha manda sobre el botón de "mañana": si no, mover una
  // vez dejaba la tarjeta pegada a un día que la frase ya no dice.
  useEffect(() => {
    setDueOverride(null);
  }, [parsed.dueDate]);

  const previewTask: Task = {
    rowId: -1,
    toDo: parsed.title || "…",
    statusFinalOutcome: previewDone ? "Done" : "To-do",
    tipo: chosenTipo,
    nextStep: "",
    dueDateNextStep: effectiveDue,
    statusNextStep: "",
    recurrenceInterval: null,
    recurrenceUnit: null,
    isPriority: previewPriority
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

  // Las que inventó la persona, que no están en la lista canónica y por lo tanto
  // no se dibujaban en ninguna parte: apretar "Agregar" no daba ninguna señal.
  //
  // Sale de `selected` y no de `finalCategories` a propósito. `finalCategories`
  // incluye lo que hay escrito en el campo pero aún no agregado —así no se pierde
  // si aprietan Seguir sin más— y dibujar eso aquí ponía un chip con una × que no
  // hacía nada: `toggle` opera sobre `selected`, donde ese valor todavía no está.
  const invented = normalizeTipoOptions(selected).filter(
    (name) => !CANONICAL_CATEGORIES.some((canonical) => canonical.toLowerCase() === name.toLowerCase())
  );

  const amountValue = Number(String(debtAmount).replace(",", "."));
  const debtIsUsable = debtName.trim().length > 0 && Number.isFinite(amountValue) && amountValue > 0;

  const finish = () =>
    onComplete({
      categories: finalCategories,
      timezone,
      briefMorning: wantsMorning ? morning : "",
      briefEvening: wantsEvening ? evening : "",
      firstTask: parsed.title.trim()
        ? {
            title: parsed.title.trim(),
            dueDate: effectiveDue,
            tipo: chosenTipo,
            isPriority: previewPriority,
            done: previewDone
          }
        : null,
      firstDebt: debtIsUsable
        ? {
            name: debtName.trim(),
            amount: amountValue,
            currency: debtCurrency,
            direction: debtDirection,
            reason: debtReason.trim()
          }
        : null
    });

  const isLast = step === STEPS.length - 1;
  const canAdvance = !(step === 0 && finalCategories.length === 0);
  const nextLabel =
    (step === 2 && !parsed.title.trim()) || (step === 3 && !debtIsUsable) ? "Saltar" : "Seguir";

  return (
    <main className="grid min-h-screen bg-bg lg:grid-cols-[0.9fr_1.1fr]">
      {/* ── Panel nocturno: el mismo lenguaje de la pantalla de acceso ──────── */}
      <section
        className="relative hidden flex-col overflow-hidden px-12 py-14 text-white lg:flex"
        style={{ background: "linear-gradient(155deg, var(--night-2) 0%, var(--night-1) 62%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
          style={{
            background:
              "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(232,145,43,.30), rgba(232,145,43,.08) 45%, transparent 72%)"
          }}
        />
        <div className="relative flex flex-1 flex-col">
          <Wordmark tone="night" />

          <h1 className="mt-12 max-w-[15ch] font-display text-[clamp(28px,3vw,40px)] font-bold leading-[1.12] tracking-tight">
            Cinco minutos, y Sydney te conoce.
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15.5px] leading-relaxed text-[#B9BEE0]">
            Nada de esto queda escrito en piedra: todo se cambia después en Ajustes. Lo
            preguntamos ahora para que el primer día ya sirva.
          </p>

          <ol className="mt-12 space-y-3.5">
            {STEPS.map((entry, index) => (
              <li key={entry.label} className="flex items-center gap-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "grid h-7 w-7 flex-none place-items-center rounded-full border text-[12px] font-semibold transition-colors",
                    index < step
                      ? "border-transparent bg-amber text-[#1A1200]"
                      : index === step
                        ? "border-white bg-white text-[#141833]"
                        : "border-white/25 text-[#8E95C4]"
                  )}
                >
                  {index < step ? "✓" : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[14px] transition-colors",
                    index === step ? "font-semibold text-white" : "text-[#8E95C4]"
                  )}
                >
                  {entry.label}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-auto max-w-[36ch] border-t border-white/15 pt-5 text-[12.5px] text-[#767DA8]">
            Aquí o en Telegram, da igual: es la misma cuenta y la misma lista.
          </p>
        </div>
      </section>

      {/* ── El paso ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col bg-surface px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="lg:hidden">
            <Wordmark />
          </div>
          <p className="hidden font-display text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3 lg:block">
            {STEPS[step].eyebrow}
          </p>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            className="grid h-9 w-9 flex-none place-items-center rounded-field border border-line text-[15px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </header>

        {/* Barra de progreso, solo en móvil: en escritorio la lista lateral ya lo dice. */}
        <ol className="mb-7 flex items-center gap-1.5 lg:hidden" aria-label="Progreso">
          {STEPS.map((entry, index) => (
            <li
              key={entry.label}
              aria-current={index === step ? "step" : undefined}
              title={entry.label}
              className={cn(
                "h-1.5 flex-1 rounded-chip transition-all",
                index === step ? "bg-brand" : index < step ? "bg-brand/40" : "bg-line"
              )}
            />
          ))}
        </ol>

        <div className="flex w-full max-w-[34rem] flex-1 flex-col">
          {step === 0 && (
            <>
              <Head
                title="¿En qué partes se divide tu vida?"
                hint="Elige las que uses de verdad. Sirven para agrupar tus tareas, y puedes cambiarlas cuando quieras."
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
                        "rounded-chip border px-4 py-2 text-[14.5px] transition-colors",
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
                  className={cn(inputClass, "flex-1")}
                />
                <button type="button" onClick={addCustom} className={ghostClass}>
                  Agregar
                </button>
              </div>

              {invented.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                    Tuyas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {invented.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggle(name)}
                        title="Quitar"
                        className="group rounded-chip border border-brand/40 bg-brand-soft px-4 py-2 text-[14.5px] font-semibold text-brand"
                      >
                        {name}
                        <span aria-hidden className="ml-1.5 text-ink-3 group-hover:text-late">
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Head
                title="¿Cuándo te mando el resumen del día?"
                hint="Dos mensajes por Telegram, no más: en la mañana lo que viene hoy, en la noche lo que quedó pendiente. Puedes apagar cualquiera de los dos."
              />
              <label className="mb-6 block">
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
                label="☀ Resumen de la mañana"
                hint="Lo que vence hoy y lo que viene"
                enabled={wantsMorning}
                value={morning}
                onToggle={setWantsMorning}
                onChange={setMorning}
              />
              <BriefToggle
                label="☾ Resumen de la noche"
                hint="Lo que quedó sin hacer y lo de mañana"
                enabled={wantsEvening}
                value={evening}
                onToggle={setWantsEvening}
                onChange={setEvening}
              />
              {!wantsMorning && !wantsEvening && (
                <p className="mt-3 rounded-card border border-amber/30 bg-amber-soft px-3.5 py-2.5 text-[13px] text-amber-ink">
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
                hint="Como se la dirías a una persona. Si mencionas cuándo o de qué es, se entiende solo — prueba con “pagar la luz el viernes” o “mandar el informe, categoría trabajo”."
              />
              <input
                ref={taskInputRef}
                autoFocus
                value={taskText}
                onChange={(event) => setTaskText(event.target.value)}
                placeholder="pagar la luz el viernes"
                className={cn(inputClass, "text-[16px]")}
              />

              {/* Lo entendido se muestra como etiquetas, no como una frase que
                  narra su propio razonamiento.

                  Muestra `baseDue`, lo que leyó de la frase — nunca `effectiveDue`.
                  Si además movieron la tarjeta a mañana, esta etiqueta seguiría
                  diciendo “leí «el viernes»” con la fecha del sábado al lado, que
                  es una afirmación falsa sobre el parser. La fecha de verdad la
                  dice la tarjeta. */}
              {(parsed.matchedText || parsed.tipoMatchedText) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  <span className="text-ink-3">Entendí:</span>
                  {parsed.matchedText && (
                    <span className="rounded-chip border border-line bg-raised px-2.5 py-1 text-ink-2">
                      “{parsed.matchedText}” → {formatDay(baseDue, today)}
                    </span>
                  )}
                  {parsed.tipoMatchedText && (
                    <span className="rounded-chip border border-line bg-raised px-2.5 py-1 text-ink-2">
                      “{parsed.tipoMatchedText}” → {categoryLabel(chosenTipo, language)}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-ink-3">Categoría:</span>
                {finalCategories.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTaskTipo(option)}
                    aria-pressed={chosenTipo === option}
                    className={cn(
                      "rounded-chip border px-3 py-1 text-[12.5px] font-semibold transition-colors",
                      chosenTipo === option
                        ? "border-brand/40 bg-brand-soft text-brand"
                        : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
                    )}
                  >
                    {categoryLabel(option, language)}
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                Así se va a ver — pruébala
              </p>
              <div className={cn("transition-opacity", !parsed.title.trim() && "opacity-45")}>
                <TaskCard
                  task={previewTask}
                  today={today}
                  language={language}
                  onToggleDone={() => setPreviewDone((current) => !current)}
                  onEdit={() => taskInputRef.current?.focus()}
                  // Mañana, no "un día más": es lo que hace el botón de verdad,
                  // y una demostración que enseña otra cosa enseña mal.
                  onMoveTomorrow={() => setDueOverride(addDaysToIsoDate(today, 1))}
                  onTogglePriority={() => setPreviewPriority((current) => !current)}
                  onDelete={() => {
                    setTaskText("");
                    setPreviewDone(false);
                    setPreviewPriority(false);
                    setDueOverride(null);
                    taskInputRef.current?.focus();
                  }}
                />
              </div>
              <p className="mt-2.5 text-[12.5px] text-ink-3">
                {parsed.title.trim()
                  ? "Pasa el mouse por encima: los botones funcionan de verdad, y lo que dejes marcado se guarda con la tarea."
                  : "Sin fecha en la frase, queda para hoy."}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <Head
                title="¿Alguien te debe algo?"
                hint="Sydney también lleva la cuenta de las platas: lo que te deben y lo que debes, con quién y por qué. Si no se te ocurre ninguna ahora, sáltala."
              />

              <div className="mb-4 inline-flex self-start rounded-field border border-line p-0.5">
                {(["Me deben", "Debo yo"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDebtDirection(option)}
                    aria-pressed={debtDirection === option}
                    className={cn(
                      "rounded-[6px] px-4 py-1.5 text-[13.5px] font-semibold transition-colors",
                      debtDirection === option
                        ? "bg-brand text-brand-ink"
                        : "text-ink-2 hover:text-ink"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <input
                  value={debtName}
                  onChange={(event) => setDebtName(event.target.value)}
                  placeholder={debtDirection === "Me deben" ? "¿Quién te debe?" : "¿A quién le debes?"}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    value={debtAmount}
                    onChange={(event) => setDebtAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="¿Cuánto?"
                    className={cn(inputClass, "num flex-1")}
                  />
                  <select
                    value={debtCurrency}
                    onChange={(event) => setDebtCurrency(event.target.value)}
                    className={cn(inputClass, "w-28 flex-none")}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={debtReason}
                  onChange={(event) => setDebtReason(event.target.value)}
                  placeholder="¿Por qué? (opcional)"
                  className={inputClass}
                />
              </div>

              <p className="mb-2 mt-7 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                Así se va a ver
              </p>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-card border border-line border-l-[3px] bg-surface px-3.5 py-2.5 transition-opacity",
                  debtDirection === "Me deben" ? "border-l-ok" : "border-l-late",
                  !debtIsUsable && "opacity-45"
                )}
              >
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
                  {debtName.trim() || "…"}
                  {debtReason.trim() && (
                    <span className="text-ink-3"> · {debtReason.trim()}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "num flex-none text-[14.5px] font-semibold",
                    debtDirection === "Me deben" ? "text-ok" : "text-late"
                  )}
                >
                  {debtDirection === "Me deben" ? "+" : "−"}
                  {debtIsUsable ? amountValue.toLocaleString("es-CL") : "0"} {debtCurrency}
                </span>
              </div>
              <p className="mt-2.5 text-[12.5px] text-ink-3">
                Después puedes marcarla como pagada, aquí o diciéndoselo a Sydney por Telegram.
              </p>
            </>
          )}

          {step === 4 && (
            <>
              <Head
                title="Ya está. Falta una cosa."
                hint="Tus tareas y tus deudas ya viven en tu cuenta. Lo que falta es la mitad que te busca a ti."
              />

              <div className="rounded-panel border border-brand/30 bg-brand-soft p-5">
                <p className="font-display text-[17px] font-semibold leading-snug text-ink">
                  ✈ Conecta Telegram, o Sydney se queda muda.
                </p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">
                  Esta página es donde miras tus tareas cuando te acuerdas de mirarlas. Telegram es
                  donde Sydney te busca a ti: te manda el resumen{" "}
                  {wantsMorning && wantsEvening
                    ? "de la mañana y el de la noche"
                    : wantsMorning
                      ? "de la mañana"
                      : wantsEvening
                        ? "de la noche"
                        : "del día"}
                  , y le escribes desde el teléfono —o le mandas un audio— sin abrir nada.
                </p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">
                  Sin eso, esto es una lista más que hay que acordarse de visitar.
                </p>

                <div className="mt-5 border-t border-brand/20 pt-5">
                  <TelegramConnect
                    connected={telegramConnected}
                    onConnected={() => setTelegramConnected(true)}
                  />
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                <Bullet icon="↔">
                  Lo que anotes aquí aparece en Telegram, y lo que le digas a Sydney por Telegram
                  aparece aquí. Es la misma cuenta.
                </Bullet>
                <Bullet icon="🎙">
                  Mándale un audio por Telegram y lo convierte en tarea. En el computador, el
                  micrófono de la caja de arriba hace lo mismo.
                </Bullet>
                <Bullet icon="＄">
                  Las deudas van al lado de las tareas: quién te debe, a quién le debes, y en qué
                  quedó.
                </Bullet>
              </ul>

              <div className="mt-6 rounded-card border border-line bg-raised px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-2">
                {summaryLine({
                  hasTask: Boolean(parsed.title.trim()),
                  hasDebt: debtIsUsable,
                  categories: finalCategories.length,
                  wantsMorning,
                  wantsEvening
                })}
              </div>

              {/* La salida, grande y sin culpa. Conectar Telegram es lo que hace
                  que el producto sirva, pero cobrárselo aquí —con un botón chico
                  y gris al lado de uno grande y azul— convierte un "ahora no" en
                  una pantalla de la que cuesta salir. Se entra igual. */}
              <button
                type="button"
                onClick={finish}
                disabled={isSaving}
                className={cn(
                  "mt-6 w-full rounded-field px-5 py-3.5 text-[15px] font-semibold transition-colors disabled:opacity-40",
                  telegramConnected
                    ? "bg-brand text-brand-ink"
                    : "border border-line-2 bg-surface text-ink hover:border-brand/50"
                )}
              >
                {isSaving
                  ? "Guardando…"
                  : telegramConnected
                    ? "Listo — entrar"
                    : "No te preocupes, lo hago más tarde en Ajustes"}
              </button>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-card border border-late/30 bg-late-soft px-3.5 py-2.5 text-sm text-late">
              {error}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-6">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || isSaving}
              className="rounded-field px-2 py-2.5 text-sm text-ink-3 hover:text-ink disabled:invisible"
            >
              ← Atrás
            </button>

            <span className="num text-[12.5px] text-ink-3">
              {step + 1} de {STEPS.length}
            </span>

            {/* En la última pantalla el botón de entrar vive en el cuerpo, junto
                a la decisión de Telegram. Repetirlo aquí serían dos controles
                para lo mismo, y el de abajo es el que dice lo que pasa. */}
            {isLast ? (
              <span aria-hidden />
            ) : (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                disabled={!canAdvance}
                className="rounded-field bg-brand px-6 py-2.5 text-[14.5px] font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

// Sin `flex-1`: dentro de la columna flex del paso, un input con `flex-1` crece
// a lo alto hasta llenar el espacio libre y queda una caja de 90px de alto. Donde
// hace falta que ocupe el resto de una fila, se agrega ahí.
const inputClass =
  "w-full min-w-0 rounded-field border border-line bg-surface px-3.5 py-2.5 text-[14.5px] text-ink outline-none focus:border-brand/60";
const ghostClass =
  "flex-none rounded-field border border-line px-4 py-2.5 text-[14.5px] text-ink-2 hover:border-line-2 hover:text-ink";

function Head({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <h1 className="font-display text-[clamp(22px,2.2vw,28px)] font-semibold leading-tight tracking-tight text-ink">
        {title}
      </h1>
      <p className="mb-6 mt-2.5 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-2">{hint}</p>
    </>
  );
}

function Bullet({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
      <span aria-hidden className="flex-none text-brand">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function BriefToggle({
  label,
  hint,
  enabled,
  value,
  onToggle,
  onChange
}: {
  label: string;
  hint: string;
  enabled: boolean;
  value: string;
  onToggle: (enabled: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-3.5 rounded-card border border-line px-3.5 py-3">
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
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink-3">{hint}</span>
      </span>
      <input
        type="time"
        value={value}
        disabled={!enabled}
        onChange={(event) => onChange(event.target.value)}
        className="num flex-none rounded-field border border-line bg-surface px-2 py-1.5 text-[14px] text-ink outline-none disabled:opacity-40"
      />
    </div>
  );
}

/**
 * El resumen final, escrito como una frase y no como una concatenación.
 *
 * La versión anterior producía "Vas a entrar, con 3 categorías." —coma sin
 * verbo— cuando no había tarea, y decía "categorías" aunque fuera una sola.
 */
function summaryLine({
  hasTask,
  hasDebt,
  categories,
  wantsMorning,
  wantsEvening
}: {
  hasTask: boolean;
  hasDebt: boolean;
  categories: number;
  wantsMorning: boolean;
  wantsEvening: boolean;
}): string {
  const pieces: string[] = [];
  if (categories > 0) {
    pieces.push(categories === 1 ? "1 categoría" : `${categories} categorías`);
  }
  if (hasTask) pieces.push("tu primera tarea ya anotada");
  if (hasDebt) pieces.push("tu primera deuda registrada");
  if (wantsMorning && wantsEvening) pieces.push("los resúmenes de la mañana y la noche listos");
  else if (wantsMorning) pieces.push("el resumen de la mañana listo");
  else if (wantsEvening) pieces.push("el resumen de la noche listo");

  if (pieces.length === 0) return "Vas a entrar con la cuenta vacía. Todo se configura en Ajustes.";
  if (pieces.length === 1) return `Vas a entrar con ${pieces[0]}.`;
  return `Vas a entrar con ${pieces.slice(0, -1).join(", ")} y ${pieces[pieces.length - 1]}.`;
}

/** "el viernes" dicho como lo diría una persona, no como una fecha ISO. */
function formatDay(iso: string, today: string): string {
  if (iso === today) return "hoy";
  if (iso === addDaysToIsoDate(today, 1)) return "mañana";
  try {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "short"
    });
  } catch {
    return iso;
  }
}

function nowIn(timeZone: string): string {
  try {
    return new Date().toLocaleTimeString("es-CL", { timeZone, hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}
