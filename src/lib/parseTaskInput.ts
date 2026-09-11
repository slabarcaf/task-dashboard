import { addDaysToIsoDate } from "@/lib/date";

/**
 * Reads a due date out of a sentence, the way the bot already does in Telegram.
 *
 * The asymmetry this closes: you can tell Sydney "pagar la luz el viernes" in
 * Telegram and it understands, while the web made you open a date picker for the
 * same sentence. Two doors into one product should not demand two different
 * kinds of effort.
 *
 * Deliberately small. It recognises the handful of phrasings that actually turn
 * up — today/tomorrow, weekday names, "in N days", a bare date — and otherwise
 * leaves the text alone. A parser that guesses is worse than one that abstains:
 * a wrong date is invisible until the reminder fires on the wrong day.
 */

export type ParsedTaskInput = {
  /** The title with the date and category phrases removed. */
  title: string;
  /** ISO date, or null when nothing was recognised. */
  dueDate: string | null;
  /** The exact words that were consumed, for showing the user what was read. */
  matchedText: string | null;
  /** A category named in the sentence, or null. Only ever one the user already has. */
  tipo: string | null;
  /** The words that named it, for the same reason as `matchedText`. */
  tipoMatchedText: string | null;
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
};

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12
};

/**
 * Palabras que anuncian una fecha y no dicen nada por sí solas.
 *
 * Importa más de lo que parece: el prompt que se le pasa a Whisper **enseña** a
 * decir "con vencimiento mañana", así que la gente lo dicta así. Si solo se quita
 * "mañana", el título queda con un "con vencimiento," colgando — enseñamos una
 * forma de hablar y después no la entendíamos entera.
 */
const DUE_LEAD_IN = /\s*(?:,\s*)?\b(?:con\s+vencimiento(?:\s+el)?|vence\s+(?:el|la)?|fecha\s+de\s+vencimiento(?:\s+el)?|para\s+el|due(?:\s+(?:on|by))?)\s*$/i;

function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Days forward to the next occurrence of `weekday`; today counts as next week. */
function daysUntilWeekday(todayIso: string, weekday: number): number {
  const [y, m, d] = todayIso.split("-").map(Number);
  const current = new Date(y, m - 1, d).getDay();
  const delta = (weekday - current + 7) % 7;
  return delta === 0 ? 7 : delta;
}

function isoFromDayMonth(todayIso: string, day: number, month: number): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = Number(todayIso.slice(0, 4));
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // A date already behind us almost always means next year: on 20 December,
  // "el 5 de enero" is three weeks away, not eleven months back.
  return iso < todayIso ? `${year + 1}${iso.slice(4)}` : iso;
}

export function parseTaskInput(
  raw: string,
  todayIso: string,
  categories: string[] = []
): ParsedTaskInput {
  // La categoría se saca primero: suele ir al final y, si se va antes, no
  // estorba a los patrones de fecha que también miran el final de la frase.
  const category = parseCategoryIn(String(raw || ""), categories);
  const text = category.rest;
  const plain: ParsedTaskInput = {
    title: text.trim(),
    dueDate: null,
    matchedText: null,
    tipo: category.tipo,
    tipoMatchedText: category.matchedText
  };
  if (!text.trim()) return plain;

  const attempts: Array<{ re: RegExp; resolve: (m: RegExpMatchArray) => string | null }> = [
    // "hoy" / "today"
    { re: /\b(hoy|today)\b/i, resolve: () => todayIso },
    // "pasado mañana" MUST come before "mañana": the shorter rule would match
    // inside it and leave a stray "pasado" glued to the title.
    { re: /\bpasado\s+ma[nñ]ana\b/i, resolve: () => addDaysToIsoDate(todayIso, 2) },
    { re: /\b(ma[nñ]ana|tomorrow)\b/i, resolve: () => addDaysToIsoDate(todayIso, 1) },
    // "en 3 días" / "in 3 days" / "en 2 semanas"
    {
      re: /\ben\s+(\d{1,3})\s+(d[ií]as?|semanas?|days?|weeks?)\b/i,
      resolve: (m) =>
        addDaysToIsoDate(todayIso, Number(m[1]) * (/seman|week/i.test(m[2]) ? 7 : 1))
    },
    {
      re: /\bin\s+(\d{1,3})\s+(days?|weeks?)\b/i,
      resolve: (m) => addDaysToIsoDate(todayIso, Number(m[1]) * (/week/i.test(m[2]) ? 7 : 1))
    },
    // "el viernes" / "próximo viernes" / "on friday"
    {
      re: /\b(?:el\s+|next\s+|pr[oó]ximo\s+|on\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
      resolve: (m) => {
        const weekday = WEEKDAYS[fold(m[1])];
        return weekday === undefined ? null : addDaysToIsoDate(todayIso, daysUntilWeekday(todayIso, weekday));
      }
    },
    // "el 15 de marzo" / "15 mar" / "15-mar"
    {
      re: /\b(?:el\s+)?(\d{1,2})\s*(?:de\s+|[-/ ])\s*([a-zA-Záéíóúñ]{3,10})\b/i,
      resolve: (m) => {
        const month = MONTHS[fold(m[2])];
        return month === undefined ? null : isoFromDayMonth(todayIso, Number(m[1]), month);
      }
    },
    // "15/3" or "15-03"
    {
      re: /\b(\d{1,2})[-/](\d{1,2})\b(?!\d)/,
      resolve: (m) => isoFromDayMonth(todayIso, Number(m[1]), Number(m[2]))
    },
    // A full ISO date, left last so it does not get chewed by the shorter rules.
    { re: /\b(\d{4}-\d{2}-\d{2})\b/, resolve: (m) => m[1] }
  ];

  for (const attempt of attempts) {
    const match = text.match(attempt.re);
    if (!match) continue;
    const dueDate = attempt.resolve(match);
    if (!dueDate) continue;

    // El texto antes de la fecha pierde también su preámbulo ("con vencimiento"),
    // que sin la fecha no significa nada.
    const before = text.slice(0, match.index).replace(DUE_LEAD_IN, "");
    const title = tidy(before + text.slice((match.index || 0) + match[0].length));

    // Refuse to eat the whole sentence: "viernes" on its own is the task.
    if (!title) return plain;

    return { ...plain, title, dueDate, matchedText: match[0].trim() };
  }

  return plain;
}

/** Limpia los restos de haberle sacado un trozo a una frase. */
function tidy(value: string): string {
  return value
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*([,.;:])/g, "$1")
    .replace(/^[\s,;:.]+/, "")
    .replace(/[\s,;:]+$/, "")
    .trim();
}

/**
 * Saca del texto una categoría que la persona nombró explícitamente.
 *
 * **Solo formas explícitas** — "en categoría Otros", "categoría: Finanzas". No
 * busca el nombre suelto, y es a propósito: "un asunto personal" no es la
 * categoría Personal, y equivocarse aquí archiva la tarea donde nadie la va a
 * buscar. Igual que con las fechas, un parser que adivina es peor que uno que se
 * abstiene.
 *
 * Y solo reconoce categorías que esa persona ya tiene. Inventar una desde una
 * frase dictada es cómo se llena la base de vocabulario que nadie eligió.
 */
export function parseCategoryIn(
  raw: string,
  categories: string[]
): { tipo: string | null; matchedText: string | null; rest: string } {
  const text = String(raw || "");
  const match = text.match(
    /\s*(?:,\s*)?\b(?:en\s+(?:la\s+)?)?categor[ií]a\s*:?\s*([\p{L}\d][\p{L}\d\s.&-]*?)\s*$/iu
  );
  if (!match) return { tipo: null, matchedText: null, rest: text };

  const spoken = fold(match[1].replace(/[.,;:]+$/, ""));
  const hit = categories.find((category) => fold(category) === spoken);
  if (!hit) return { tipo: null, matchedText: null, rest: text };

  return {
    tipo: hit,
    matchedText: match[0].trim().replace(/[.,;:]+$/, ""),
    rest: tidy(text.slice(0, match.index))
  };
}
