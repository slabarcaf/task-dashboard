/**
 * Tests for the quick-capture date parser.
 *
 * The source is TypeScript and this repo has no test-time transpiler, so the
 * file is stripped of its type syntax and evaluated. That sounds fragile, but
 * the alternative — adding ts-node or vitest and a config — is a lot of weight
 * for one pure function. If this ever breaks, the fix is a real test runner,
 * not a cleverer strip.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/parseTaskInput.ts", import.meta.url), "utf8");

const stripped = src
  .replace(/^import[\s\S]*?;\s*$/m, "")
  .replace(/^export type[\s\S]*?^};\s*$/m, "")
  .replace(/\bexport /g, "")
  .replace(/: ParsedTaskInput\b/g, "")
  .replace(/ as ParsedTaskInput\b/g, "")
  .replace(/: Array<\{[\s\S]*?\}>/g, "")
  .replace(/: Record<string, number>/g, "")
  .replace(/: RegExpMatchArray/g, "")
  .replace(/\(([a-zA-Z]+): string\)/g, "($1)")
  .replace(/\(([a-zA-Z]+): string, ([a-zA-Z]+): number\)/g, "($1, $2)")
  .replace(/\(todayIso: string, day: number, month: number\)/g, "(todayIso, day, month)")
  .replace(/\(todayIso: string, weekday: number\)/g, "(todayIso, weekday)")
  .replace(/\(\s*raw: string,\s*todayIso: string,\s*categories: string\[\] = \[\]\s*\)/g, "(raw, todayIso, categories = [])")
  .replace(/\(\s*raw: string,\s*categories: string\[\]\s*\)/g, "(raw, categories)")
  .replace(/\(raw: string, todayIso: string\)/g, "(raw, todayIso)")
  .replace(/: \{ tipo: string \| null; matchedText: string \| null; rest: string \}/g, "")
  .replace(/: ParsedTaskInput\b/g, "")
  .replace(/\): string \| null/g, ")")
  .replace(/\): number/g, ")")
  .replace(/\): string/g, ")");

// addDaysToIsoDate is the only import; reimplemented here rather than pulled in.
const prelude = `
function addDaysToIsoDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + p(date.getMonth() + 1) + "-" + p(date.getDate());
}
`;

const parseTaskInput = new Function(`${prelude}${stripped}; return parseTaskInput;`)();

// Las categorías que tiene el usuario de las pruebas.
const CATS = ["Ayudantias", "Finanzas", "Otros", "Personal", "Golf club"];

// A Thursday, so weekday arithmetic has a fixed reference.
const TODAY = "2026-09-03";

const cases = [
  ["pagar la luz el viernes", "pagar la luz", "2026-09-04"],
  ["pagar la luz mañana", "pagar la luz", "2026-09-04"],
  ["pagar la luz manana", "pagar la luz", "2026-09-04"],
  ["llamar al dentista hoy", "llamar al dentista", "2026-09-03"],
  ["comprar pan pasado mañana", "comprar pan", "2026-09-05"],
  ["renovar seguro en 3 días", "renovar seguro", "2026-09-06"],
  ["renovar seguro en 2 semanas", "renovar seguro", "2026-09-17"],
  ["renew insurance in 10 days", "renew insurance", "2026-09-13"],
  ["call mom on monday", "call mom", "2026-09-07"],
  ["research zapatillas el 15 de septiembre", "research zapatillas", "2026-09-15"],
  ["research zapatillas 15 sep", "research zapatillas", "2026-09-15"],
  ["pagar arriendo 1/10", "pagar arriendo", "2026-10-01"],
  ["revisar contrato 2026-12-24", "revisar contrato", "2026-12-24"]
];

for (const [input, title, due] of cases) {
  test(`parses: ${input}`, () => {
    const result = parseTaskInput(input, TODAY);
    assert.equal(result.title, title, "title");
    assert.equal(result.dueDate, due, "dueDate");
  });
}

test("a weekday that is today means next week, not today", () => {
  // TODAY is a Thursday.
  assert.equal(parseTaskInput("hacer algo el jueves", TODAY).dueDate, "2026-09-10");
});

test("a date already past rolls into next year", () => {
  assert.equal(parseTaskInput("pagar patente el 5 de enero", "2026-12-20").dueDate, "2027-01-05");
});

test("leaves text alone when there is no date", () => {
  const result = parseTaskInput("revisar el CV de Bela", TODAY);
  assert.equal(result.dueDate, null);
  assert.equal(result.title, "revisar el CV de Bela");
});

test("refuses to eat the whole sentence", () => {
  // "viernes" alone is the task, not an empty task due Friday.
  const result = parseTaskInput("viernes", TODAY);
  assert.equal(result.dueDate, null);
  assert.equal(result.title, "viernes");
});

test("an impossible date is not a date", () => {
  const result = parseTaskInput("comprar algo el 31 de febrero", TODAY);
  assert.equal(result.dueDate, null);
});

test("empty input stays empty", () => {
  assert.deepEqual(parseTaskInput("   ", TODAY), {
    title: "",
    dueDate: null,
    matchedText: null,
    tipo: null,
    tipoMatchedText: null
  });
});

// ── preámbulos de fecha ──────────────────────────────────────────────────────
// El prompt de Whisper enseña a decir "con vencimiento mañana". Si el parser
// solo se lleva la fecha, el título queda con un "con vencimiento," colgando:
// enseñábamos una forma de hablar y no la entendíamos entera.

test("strips the lead-in that announces a date", () => {
  const r = parseTaskInput("pagar la luz, con vencimiento el viernes", TODAY);
  assert.equal(r.title, "pagar la luz");
  assert.equal(r.dueDate, "2026-09-04");
});

test("handles 'vence el' too", () => {
  assert.equal(parseTaskInput("renovar el seguro vence el viernes", TODAY).title, "renovar el seguro");
});

test("handles 'fecha de vencimiento'", () => {
  assert.equal(
    parseTaskInput("firmar el contrato, fecha de vencimiento mañana", TODAY).title,
    "firmar el contrato"
  );
});

test("a lead-in with no date after it is left alone", () => {
  const r = parseTaskInput("revisar el vencimiento del pasaporte", TODAY);
  assert.equal(r.dueDate, null);
  assert.equal(r.title, "revisar el vencimiento del pasaporte");
});

// ── categoría dictada ────────────────────────────────────────────────────────

test("picks up an explicitly named category and removes it", () => {
  const r = parseTaskInput("comprar pan, en categoría Otros", TODAY, CATS);
  assert.equal(r.tipo, "Otros");
  assert.equal(r.title, "comprar pan");
});

test("category and date in the same sentence", () => {
  const r = parseTaskInput("pagar la luz el viernes, categoría Finanzas", TODAY, CATS);
  assert.equal(r.tipo, "Finanzas");
  assert.equal(r.dueDate, "2026-09-04");
  assert.equal(r.title, "pagar la luz");
});

test("matches without accents and regardless of case", () => {
  assert.equal(parseTaskInput("revisar algo en categoria AYUDANTIAS", TODAY, CATS).tipo, "Ayudantias");
});

test("a category whose name has a space", () => {
  assert.equal(parseTaskInput("reservar cancha, categoría Golf club", TODAY, CATS).tipo, "Golf club");
});

test("a category the user does not have is not invented", () => {
  const r = parseTaskInput("algo, en categoría Marketing", TODAY, CATS);
  assert.equal(r.tipo, null);
  // Y el texto queda intacto: no se borra lo que no se entendió.
  assert.match(r.title, /Marketing/);
});

test("a bare category name is NOT taken as the category", () => {
  // "un asunto personal" no es la categoría Personal. Adivinar aquí archiva la
  // tarea donde nadie la va a buscar.
  assert.equal(parseTaskInput("resolver un asunto personal", TODAY, CATS).tipo, null);
});

test("with no known categories nothing is matched", () => {
  assert.equal(parseTaskInput("comprar pan, en categoría Otros", TODAY).tipo, null);
});

test("the whole dictated sentence, end to end", () => {
  const r = parseTaskInput(
    "A delegar tarea de amar a mi mujer, con vencimiento hoy, en categoría Otros.",
    TODAY,
    CATS
  );
  assert.equal(r.title, "A delegar tarea de amar a mi mujer");
  assert.equal(r.dueDate, TODAY);
  assert.equal(r.tipo, "Otros");
});
