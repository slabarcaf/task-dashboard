/**
 * El prompt que se le pasa a Whisper.
 *
 * No es decorativo: sin él, "con vencimiento mañana" se transcribe como
 * "Convencimiento mañana" de forma consistente en español. Whisper usa este
 * texto como pista de vocabulario, no como instrucción.
 *
 * El vocabulario genérico es el del dominio —fechas, vencimientos, pendientes—
 * y sirve a cualquiera. A eso se le suman **las categorías propias de la
 * persona**, que es lo que hace que "Ayudantías" o "Mudanza" se escriban bien
 * para quien de verdad las usa. La versión que vivía en el bot listaba nombres
 * propios de Santiago; eso ayudaba a un usuario y estorbaba al resto.
 */

const BASE_ES =
  "Notas sobre tareas, agenda y recordatorios. Vocabulario frecuente: con vencimiento " +
  "mañana, con vencimiento el viernes, fecha de vencimiento, próximo paso, prioridad, " +
  "pendientes, tarea, recordatorio, deuda, me deben, debo yo, calendario, la próxima semana.";

const BASE_EN =
  "Notes about tasks, schedule and reminders. Frequent vocabulary: due tomorrow, due on " +
  "Friday, due date, next step, priority, pending, task, reminder, debt, they owe me, " +
  "I owe, calendar, next week.";

export function buildVoicePrompt(language: string, categories: string[]): string {
  const base = language === "en" ? BASE_EN : BASE_ES;
  const names = categories.map((value) => String(value || "").trim()).filter(Boolean);
  if (names.length === 0) return base;
  // Se cortan a 20: un prompt largo deja de ser una pista y empieza a sesgar.
  const label = language === "en" ? "Categories" : "Categorías";
  return `${base} ${label}: ${names.slice(0, 20).join(", ")}.`;
}
