/**
 * El día que se dibuja es el del que mira, no el de UTC.
 *
 * Postgres guarda `debts.created_at` como TIMESTAMPTZ y la API lo serializa con
 * `toISOString()`, o sea en UTC. `DebtsView` cortaba los diez primeros
 * caracteres de esa cadena, que es el día **en UTC**. Observado el 2026-09-14 a
 * las 20:43 en America/Los_Angeles: la deuda recién creada decía "15-Sep".
 *
 * El error no es de un instante raro, es de todas las tardes: en la costa oeste
 * cualquier cosa creada después de las 17:00 (16:00 en invierno) se dibujaba
 * con la fecha de mañana. Estas pruebas clavan el arreglo.
 *
 * ⚠️ Las fechas de las tareas NO pasan por acá y no tienen este problema:
 * `tasks.due_date_next_step` es un DATE y `listTasksByUser` lo saca con
 * `to_char(..., 'YYYY-MM-DD')`, así que llega a la web ya como día calendario,
 * sin hora ni zona que convertir. Comprobado leyendo la consulta, no supuesto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

/** Compila un módulo TS del repo y lo evalúa. Mismo truco que `i18n.test.mjs`. */
function load(path) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "cjs" });
  const module = { exports: {} };
  new Function("module", "exports", "require", code)(module, module.exports, () => ({}));
  return module.exports;
}

const { isoDateInZone } = load("src/lib/i18n/format.ts");
const { formatShortDate } = load("src/lib/date.ts");

const LA = "America/Los_Angeles";

test("un instante ya de mañana en UTC sigue siendo hoy en Los Angeles", () => {
  // Las 20:43 del 14 de septiembre en Los Angeles son las 03:43 del 15 en UTC.
  assert.equal(isoDateInZone("2026-09-15T03:43:00.000Z", LA), "2026-09-14");
  // El recorte viejo, para que se vea qué se está arreglando.
  assert.equal("2026-09-15T03:43:00.000Z".slice(0, 10), "2026-09-15");
});

test("la fila de la deuda dibuja el día de la persona", () => {
  // El año se calcula porque `formatShortDate` esconde el año cuando es el
  // actual. Una fecha clavada en 2026 volvería esta prueba roja en 2027 por una
  // razón que no tiene nada que ver con lo que vino a comprobar.
  const year = new Date().getFullYear();
  const justAfterUtcMidnight = new Date(Date.UTC(year, 8, 15, 3, 43)).toISOString();

  assert.equal(formatShortDate(isoDateInZone(justAfterUtcMidnight, LA), "en"), "14-Sep");
  assert.equal(formatShortDate(isoDateInZone(justAfterUtcMidnight, LA), "es"), "14-Sep");
});

test("una zona al este de UTC puede adelantar el día, no solo atrasarlo", () => {
  // 23:30 UTC del 14 son las 08:30 del 15 en Tokio.
  assert.equal(isoDateInZone("2026-09-14T23:30:00.000Z", "Asia/Tokyo"), "2026-09-15");
});

test("Santiago tambien corre el dia", () => {
  // Junio: Chile en UTC-4, así que las 02:00 UTC del 15 son las 22:00 del 14.
  assert.equal(isoDateInZone("2026-06-15T02:00:00.000Z", "America/Santiago"), "2026-06-14");
});

test("al mediodia UTC ninguna de las dos zonas discute", () => {
  assert.equal(isoDateInZone("2026-09-14T12:00:00.000Z", LA), "2026-09-14");
  assert.equal(isoDateInZone("2026-09-14T12:00:00.000Z", "UTC"), "2026-09-14");
});

test("lo que no se puede convertir no rompe la pantalla", () => {
  // Zona inventada: cae al recorte de siempre en vez de lanzar.
  assert.equal(isoDateInZone("2026-09-15T03:43:00.000Z", "Marte/Olympus"), "2026-09-15");
  // Timestamp basura: devuelve lo que hay, sin lanzar.
  assert.equal(isoDateInZone("no es una fecha", LA), "no es una ");
  assert.equal(isoDateInZone("", LA), "");
});

test("sin zona de cuenta se usa la del dispositivo, nunca UTC", () => {
  const rendered = isoDateInZone("2026-09-15T03:43:00.000Z", "");
  assert.match(rendered, /^\d{4}-\d{2}-\d{2}$/);

  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(rendered, isoDateInZone("2026-09-15T03:43:00.000Z", deviceZone));
});

/**
 * El trinquete. La prueba de arriba comprueba el ayudante; esta comprueba que
 * la pantalla lo esté usando, que es lo que se rompió la primera vez.
 */
test("ninguna vista corta un timestamp para sacarle el dia", () => {
  const view = readFileSync(new URL("../src/components/DebtsView.tsx", import.meta.url), "utf8");
  assert.equal(
    /createdAt\s*\.?\s*slice\(/.test(view),
    false,
    "DebtsView volvió a recortar createdAt: eso toma el día en UTC, usa isoDateInZone"
  );
  assert.equal(view.includes("isoDateInZone(debt.createdAt, timeZone)"), true);
});
