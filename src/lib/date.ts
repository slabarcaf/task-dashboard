export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIsoDate(): string {
  return formatDateForInput(new Date());
}

export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDaysToIsoDate(iso: string, days: number): string {
  const date = isoToLocalDate(iso);
  date.setDate(date.getDate() + days);
  return formatDateForInput(date);
}

export function compareIsoDates(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function endOfWeekIsoDate(referenceIso: string): string {
  const date = isoToLocalDate(referenceIso);
  const day = date.getDay();
  const daysUntilSunday = (7 - day) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  return formatDateForInput(date);
}

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysBetweenIsoDates(from: string, to: string): number {
  const a = isoToLocalDate(from);
  const b = isoToLocalDate(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * "5-Sep", or "5-Sep-27" when the year is not the current one.
 *
 * Same shape the bot uses in Telegram (`fmtDate` in tasks-mcp.js). The two
 * surfaces showing a date differently is the kind of small mismatch that makes
 * one product feel like two.
 */
export function formatShortDate(iso: string, language: "es" | "en" = "es"): string {
  if (!iso) return "";
  const date = isoToLocalDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = language === "en" ? MONTHS_EN : MONTHS_ES;
  const base = `${date.getDate()}-${months[date.getMonth()]}`;
  const currentYear = new Date().getFullYear();
  return date.getFullYear() === currentYear ? base : `${base}-${String(date.getFullYear()).slice(2)}`;
}

/**
 * How a due date reads on a card: "Hoy", "Mañana", "hace 5 días", "en 3 días".
 * Returns null when there is nothing worth saying beyond the date itself.
 */
export function relativeDueLabel(
  iso: string,
  today: string,
  language: "es" | "en" = "es"
): string | null {
  if (!iso) return null;
  const delta = daysBetweenIsoDates(today, iso);
  const es = language !== "en";
  if (delta === 0) return es ? "Hoy" : "Today";
  if (delta === 1) return es ? "Mañana" : "Tomorrow";
  if (delta === -1) return es ? "Ayer" : "Yesterday";
  if (delta < 0) {
    const n = Math.abs(delta);
    return es ? `hace ${n} días` : `${n} days ago`;
  }
  if (delta <= 7) return es ? `en ${delta} días` : `in ${delta} days`;
  return null;
}
