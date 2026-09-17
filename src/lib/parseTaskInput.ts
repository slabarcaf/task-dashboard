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
const DUE_LEAD_IN = /\s*(?:,\s*)?\b(?:con\s+vencimiento(?:\s+el)?|vence\s+(?:el|la)?|fecha\s+de\s+vencimiento(?:\s+el)?|para(?:\s+el)?|due(?:\s+(?:on|by))?)\s*$/i;

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

/**
 * Ordinales que pueden preceder a un día de la semana. `-1` es "el último".
 *
 * No incluye "quinto/fifth" por descuido: un quinto lunes existe en algunos
 * meses y en otros no, y un ordinal que a veces no tiene respuesta es
 * exactamente el que conviene no ofrecer.
 */
const ORDINALS: Record<string, number> = {
  primer: 1, primero: 1, primera: 1, "1er": 1, "1ro": 1, "1": 1,
  first: 1, "1st": 1,
  segundo: 2, segunda: 2, "2do": 2, "2": 2, second: 2, "2nd": 2,
  tercer: 3, tercero: 3, tercera: 3, "3er": 3, "3ro": 3, "3": 3, third: 3, "3rd": 3,
  cuarto: 4, cuarta: 4, "4to": 4, "4": 4, fourth: 4, "4th": 4,
  ultimo: -1, ultima: -1, last: -1
};

function isoOf(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * "el primer lunes de octubre" — el enésimo día de la semana de un mes dado.
 *
 * Existe porque sin él la regla del día suelto se quedaba con "lunes" y
 * devolvía **el lunes que viene**, ignorando en silencio "primer" y "octubre".
 * Una fecha equivocada no se nota hasta que el recordatorio suena el día que no
 * era, y era una respuesta con toda la seguridad del mundo.
 *
 * Si el mes ya pasó este año, se va al siguiente — el mismo criterio que
 * `isoFromDayMonth`, por la misma razón: en diciembre, "el primer lunes de
 * enero" está a tres semanas y no once meses atrás.
 */
function nthWeekdayOfMonth(
  todayIso: string,
  ordinal: number,
  weekday: number,
  month: number
): string | null {
  const build = (year: number): string | null => {
    if (ordinal === -1) {
      // El día 0 del mes siguiente es el último del mes buscado.
      const lastDay = new Date(year, month, 0).getDate();
      const last = new Date(year, month - 1, lastDay);
      return isoOf(new Date(year, month - 1, lastDay - ((last.getDay() - weekday + 7) % 7)));
    }
    const first = new Date(year, month - 1, 1);
    const day = 1 + ((weekday - first.getDay() + 7) % 7) + (ordinal - 1) * 7;
    const candidate = new Date(year, month - 1, day);
    // Un "cuarto martes" puede caerse del mes. Si se cae, no hay respuesta.
    return candidate.getMonth() === month - 1 ? isoOf(candidate) : null;
  };

  const year = Number(todayIso.slice(0, 4));
  const thisYear = build(year);
  if (thisYear && thisYear >= todayIso) return thisYear;
  const nextYear = build(year + 1);
  return nextYear && nextYear >= todayIso ? nextYear : null;
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

  const attempts: Array<{
    re: RegExp;
    resolve: (m: RegExpMatchArray) => string | null;
    /** Casó pero no resolvió: nadie más lo intenta. Ver la regla del ordinal. */
    exclusive?: boolean;
  }> = [
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
    // "el primer lunes de octubre" / "the last friday of november".
    //
    // ⚠️ Va ANTES de la regla del día suelto, y ese orden es todo el arreglo: la
    // regla de abajo casa con "lunes" dentro de esta frase y devuelve el lunes
    // que viene, tirando "primer" y "octubre" a la basura sin decir nada.
    //
    // `exclusive` significa: si esta frase casó y no se pudo resolver, no lo
    // intente nadie más. Sin eso, un "cuarto martes" que no existe se caería a
    // la regla del día suelto y volvería el mismo error que vinimos a arreglar.
    {
      exclusive: true,
      re: /\b(?:el\s+|the\s+)?(primer[oa]?|1er|1ro|1st|first|segund[oa]?|2do|2nd|second|tercer[oa]?|3er|3ro|3rd|third|cuart[oa]|4to|4th|fourth|[uú]ltim[oa]|last)\s+(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:de[l]?\s+(?:mes\s+de\s+)?|of\s+|in\s+)([a-zA-Z\u00e0-\u00ff]{3,10})\b/i,
      resolve: (m) => {
        const ordinal = ORDINALS[fold(m[1])];
        const weekday = WEEKDAYS[fold(m[2])];
        const month = MONTHS[fold(m[3])];
        if (ordinal === undefined || weekday === undefined || month === undefined) return null;
        return nthWeekdayOfMonth(todayIso, ordinal, weekday, month);
      }
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
    if (!dueDate) {
      // Abstenerse es mejor que adivinar, y una regla exclusiva que casó ya dijo
      // de qué habla la frase: dejar que otra conteste sería contestar mal.
      if (attempt.exclusive) return plain;
      continue;
    }

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
    // También el punto final. Whisper termina toda transcripción con uno, así
    // que sin esto una tarea dictada queda con punto y una escrita a mano no —
    // la misma tarea se ve distinta según por dónde entró.
    .replace(/[\s,;:.]+$/, "")
    .trim();
}

/**
 * Igual que una letra, pero tolerando su versión con tilde.
 *
 * Hace falta porque el texto **no se puede normalizar antes de buscar**: quitarle
 * los acentos le cambia la longitud, y entonces los índices que devuelve el match
 * ya no sirven para recortar la frase. Así la comparación es flexible y las
 * posiciones siguen siendo las del texto original.
 */
const ACCENT_CLASSES: Record<string, string> = {
  a: "[a\u00e1\u00e0\u00e4\u00e2]",
  e: "[e\u00e9\u00e8\u00eb\u00ea]",
  i: "[i\u00ed\u00ec\u00ef\u00ee]",
  o: "[o\u00f3\u00f2\u00f6\u00f4]",
  u: "[u\u00fa\u00f9\u00fc\u00fb]",
  n: "[n\u00f1]",
  c: "[c\u00e7]"
};

function accentInsensitive(name: string): string {
  return name
    .split("")
    .map((char) => {
      if (/\s/.test(char)) return "\\s+";
      const base = fold(char);
      if (ACCENT_CLASSES[base]) return ACCENT_CLASSES[base];
      return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
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
 * ⚠️ El nombre se busca contra **la lista de esa persona**, y la frase puede ir
 * en cualquier parte. La primera versión la anclaba al final con `$` y fallaba
 * en "en categoría otros, para mañana" — que es exactamente como habla alguien
 * dictando: la categoría en el medio y la fecha después.
 */
export function parseCategoryIn(
  raw: string,
  categories: string[]
): { tipo: string | null; matchedText: string | null; rest: string } {
  const text = String(raw || "");
  const usable = categories.map((value) => String(value || "").trim()).filter(Boolean);
  if (!text.trim() || usable.length === 0) return { tipo: null, matchedText: null, rest: text };

  // Más largas primero: si existieran "Golf" y "Golf club", gana la específica.
  const alternation = [...usable]
    .sort((a, b) => b.length - a.length)
    .map(accentInsensitive)
    .join("|");

  // Los dos idiomas en la misma alternancia, sin mirar la preferencia de nadie.
  // Es deliberado: la caja de captura acepta lo que se le dicte, y alguien que
  // tiene la app en español puede escribir "category: work" igual que alguien
  // en inglés puede escribir "categoría trabajo". Filtrar por preferencia sería
  // negarle a la persona una frase que entendemos perfectamente.
  //
  // El inglés faltaba entero: la versión anterior exigía la palabra literal
  // "categoría", así que en inglés esta detección no existía — el resto del
  // parser ya era bilingüe (hoy/today, mañana/tomorrow, los días y los meses).
  const pattern = new RegExp(
    `(?:,\\s*)?\\b(?:en\\s+(?:la\\s+)?|in\\s+(?:the\\s+)?)?(?:categor[i\u00ed]a|category)\\s*:?\\s*(${alternation})\\b`,
    "iu"
  );
  const match = text.match(pattern);
  if (!match || match.index === undefined) return { tipo: null, matchedText: null, rest: text };

  const spoken = fold(match[1]);
  const hit = usable.find((category) => fold(category) === spoken);
  if (!hit) return { tipo: null, matchedText: null, rest: text };

  return {
    tipo: hit,
    matchedText: match[0].trim().replace(/^[,\s]+/, ""),
    rest: tidy(text.slice(0, match.index) + text.slice(match.index + match[0].length))
  };
}
