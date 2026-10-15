/**
 * El feed matutino de Muse: qué cuenta como vencido y cuál es "hoy".
 *
 * Lo que importa clavar es la zona. Vercel corre en UTC; a las 18:00 de
 * California ya es mañana en UTC, y un brief que calcule "hoy" ahí le diría a la
 * persona que lo de mañana vence hoy — el mismo error que dateZone.test.mjs ya
 * atrapó una vez en las deudas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

function load(path) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "cjs" });
  const module = { exports: {} };
  new Function("module", "exports", "require", code)(module, module.exports, () => ({}));
  return module.exports;
}

const { todayInZone, buildBrief, filterTasks, parseTaskView, isOpen } = load("src/lib/museBrief.ts");

// 2026-10-15 18:30 en Los Ángeles = 2026-10-16 01:30 UTC.
const EVENING_LA = new Date("2026-10-16T01:30:00Z");
const TZ = "America/Los_Angeles";

const task = (rowId, due, extra = {}) => ({
  rowId,
  toDo: `t${rowId}`,
  statusFinalOutcome: "To-do",
  tipo: "Otros",
  nextStep: "",
  dueDateNextStep: due,
  isPriority: false,
  ...extra
});

test("hoy es el de la persona, no el de UTC", () => {
  assert.equal(todayInZone(TZ, EVENING_LA), "2026-10-15");
  assert.equal(todayInZone("UTC", EVENING_LA), "2026-10-16");
});

test("una zona inválida no rompe el brief", () => {
  assert.equal(todayInZone("Marte/Olympus", EVENING_LA), "2026-10-15");
});

test("vencidas, de hoy, prioritarias y próximas no se repiten", () => {
  const tasks = [
    task(1, "2026-10-14"),
    task(2, "2026-10-15"),
    task(3, "2026-10-16"),
    task(4, "2026-10-30", { isPriority: true }),
    task(5, "2026-10-14", { isPriority: true }),
    task(6, "2026-10-14", { statusFinalOutcome: "Done" }),
    task(7, "2026-10-17", { statusFinalOutcome: "Cancelar" }),
    task(8, "2026-10-25")
  ];
  const brief = buildBrief(tasks, [], TZ, EVENING_LA);
  assert.equal(brief.today, "2026-10-15");
  assert.deepEqual(brief.overdue.map((t) => t.rowId), [1, 5]);
  assert.deepEqual(brief.dueToday.map((t) => t.rowId), [2]);
  assert.deepEqual(brief.priority.map((t) => t.rowId), [4]);
  assert.deepEqual(brief.upcoming.map((t) => t.rowId), [3]);
  assert.equal(brief.counts.open, 6);
});

test("deudas pendientes separadas por dirección; las pagadas no salen", () => {
  const debts = [
    { id: 1, name: "A", amount: 10, currency: "USD", direction: "Debo yo", reason: "", status: "Por pagar" },
    { id: 2, name: "B", amount: 20, currency: "USD", direction: "Me deben", reason: "", status: "Por pagar" },
    { id: 3, name: "C", amount: 30, currency: "USD", direction: "Debo yo", reason: "", status: "Pagado" }
  ];
  const brief = buildBrief([], debts, TZ, EVENING_LA);
  assert.deepEqual(brief.pendingDebts.owedByMe.map((d) => d.id), [1]);
  assert.deepEqual(brief.pendingDebts.owedToMe.map((d) => d.id), [2]);
  assert.equal(brief.counts.pendingDebts, 2);
});

test("vistas de la lista de tareas", () => {
  const tasks = [task(1, "2026-10-14"), task(2, "2026-10-16"), task(3, "2026-10-01", { statusFinalOutcome: "Done" })];
  assert.deepEqual(filterTasks(tasks, "all", TZ, EVENING_LA).map((t) => t.rowId), [1, 2, 3]);
  assert.deepEqual(filterTasks(tasks, "open", TZ, EVENING_LA).map((t) => t.rowId), [1, 2]);
  assert.deepEqual(filterTasks(tasks, "overdue_and_today", TZ, EVENING_LA).map((t) => t.rowId), [1]);
  assert.equal(parseTaskView("cualquier cosa"), "open");
  assert.equal(isOpen({ statusFinalOutcome: "On hold" }), true);
});
