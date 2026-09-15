/**
 * El trinquete de la traducción.
 *
 * `tsc` ya cubre la paridad de llaves entera —falta una, sobra una, cambia la
 * aridad de una interpolación— y lo hace gratis, en tiempo de compilación.
 * Comprobado provocando las tres fallas a propósito antes de confiar en él.
 *
 * Quedan dos cosas que `tsc` no puede ver, y son estas:
 *
 *  1. Un literal en español dejado dentro del JSX de un archivo ya traducido.
 *  2. Un catálogo inglés estructuralmente perfecto con los valores todavía en
 *     español — o sea, "copié el ES y me interrumpieron". A `tsc` le parece
 *     impecable, y es la falla más probable de las dos.
 *
 * El (2) se comprueba **comparando los valores contra el catálogo español**, no
 * buscando acentos. La primera versión de esta prueba buscaba acentos y la
 * probé dejando "Tus tareas, en la web y en Telegram." en el archivo inglés:
 * pasó en verde. La frase no tiene un solo acento. Buscar acentos habría
 * cubierto justo los casos que no importan y dejado pasar el que sí.
 *
 * ⚠️ **Sigue siendo un trinquete, no una prueba.** Compara hojas de texto; los
 * valores que son funciones no se pueden comparar sin llamarlas, y no se
 * llaman. Hace visible la regresión y cuesta milisegundos; no certifica que algo
 * esté completo. Venderlo como lo segundo sería peor que no tenerlo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Los archivos que YA se tradujeron. La lista crece con cada fase, y esa es la
 * mecánica entera del trinquete: un archivo que entra acá no puede volver a
 * tener español suelto sin que el CI lo diga.
 *
 * Un archivo que todavía no se tocó no está en la lista y no se revisa. Una
 * lista que revisara todo estaría roja desde el primer día, y una prueba
 * siempre roja no la lee nadie.
 */
const TRANSLATED = [
  // Fase 1 — el camino de la demo.
  "src/app/page.tsx",
  "src/components/AppShell.tsx",
  "src/components/BoardView.tsx",
  "src/components/CategoryFilter.tsx",
  "src/components/CommandPalette.tsx",
  "src/components/EditTaskDialog.tsx",
  "src/components/QuickCapture.tsx",
  "src/components/SignInScreen.tsx",
  "src/components/TaskCard.tsx",
  "src/components/TaskSection.tsx",
  "src/components/TodayView.tsx",
  // Fase 2 — plata y ajustes.
  "src/app/ajustes/page.tsx",
  "src/components/DebtsView.tsx",
  "src/components/TelegramConnect.tsx",
  "src/components/TelegramNudge.tsx",
  "src/components/VoiceButton.tsx",
  "src/components/ui/Toast.tsx"
];

/**
 * Valores **guardados**, no etiquetas: viajan a Postgres y a Telegram tal cual y
 * no se traducen nunca. Tenerlos en una lista revisada vuelve explícita la
 * frontera identificador/etiqueta, que es el verdadero valor de esta lista.
 */
const WIRE_VALUES = [
  // Rutas. `/ajustes` es una URL en español y se queda así: cambiarla rompería
  // enlaces guardados y no le cambia un texto a nadie. Un esquema /es/ /en/
  // se descartó a propósito — el idioma es una preferencia de cuenta, y
  // sacarlo de la URL crearía una segunda fuente de verdad que puede
  // contradecir a `users.language`.
  "/ajustes",
  "/admin",
  "Me deben",
  "Debo yo",
  "Por pagar",
  "Pagado",
  "Otros",
  "Finanzas",
  "Estudios",
  "Salud",
  "Personal",
  "Clases",
  "Ayudantias"
];

/**
 * Quita comentarios antes de buscar. Decide si esta prueba sirve o estorba: los
 * comentarios de este repo son densamente españoles a propósito y no deben
 * marcarse jamás.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

function stripWireValues(source) {
  return WIRE_VALUES.reduce((text, value) => text.split(value).join(" "), source);
}

const ACCENTS = /[áéíóúñ¡¿ÁÉÍÓÚÑ]/;
// Lista corta y dura: palabras que solo aparecen como interfaz. Deliberadamente
// no es una lista de palabras vacías del español, que sería puro ruido.
const SPANISH_WORDS =
  /\b(Cargando|Guardando|Eliminar|Guardar|Agregar|Buscar|Cancelar|Cerrar|Volver|Ajustes|Salir|tareas?|deudas?|categorías?)\b/i;

test("los archivos ya traducidos no tienen español suelto", () => {
  for (const path of TRANSLATED) {
    const source = stripWireValues(stripComments(read(path)));
    const offenders = source
      .split("\n")
      .map((line, index) => [index + 1, line])
      .filter(([, line]) => ACCENTS.test(line) || SPANISH_WORDS.test(line));

    assert.deepEqual(
      offenders,
      [],
      `${path} tiene español fuera del catálogo:\n` +
        offenders.map(([n, line]) => `  ${n}: ${line.trim()}`).join("\n")
    );
  }
});

/**
 * Textos que es correcto que sean idénticos en los dos idiomas. Cada uno con su
 * razón — la lista se revisa, no se engorda.
 */
const SAME_IN_BOTH = new Set([
  "Sydney", // el nombre del producto
  "Telegram", // idem, es de otro producto
  "Español", // el nombre de un idioma se dibuja en su propio idioma: quien lo
  "English", // busca, busca la palabra que conoce
  "Personal", // identificador de categoría, idéntico en ambos
  "Networking",
  "Golf club",
  "Recruiting"
]);

/** Compila el catálogo y lo evalúa. Es TypeScript; Next lo compila, y acá esbuild. */
function loadCatalog(path, exportName) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "cjs" });
  // Los únicos imports en tiempo de ejecución que el catálogo puede tener son
  // los ayudantes de `plural.ts`. Se resuelven acá en vez de montar un cargador
  // entero para el alias `@/`.
  const requireShim = () => ({
    plural: (n, one, many) => (n === 1 ? one : many),
    list: (items, and) =>
      items.length <= 1
        ? items[0] ?? ""
        : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", code)(module, module.exports, requireShim);
  return module.exports[exportName];
}

/** Recorre el catálogo y devuelve `ruta.con.puntos -> texto` de cada hoja de texto. */
function textLeaves(node, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      textLeaves(value, path, out);
    }
    // Las funciones y los arreglos se saltan a propósito: comparar una función
    // exigiría llamarla con argumentos inventados, y un argumento inventado
    // puede tomar una rama que no es la que se quería mirar.
  }
  return out;
}

test("el catálogo inglés no quedó en español", () => {
  const spanish = textLeaves(loadCatalog("src/lib/i18n/messages.es.ts", "es"));
  const english = textLeaves(loadCatalog("src/lib/i18n/messages.en.ts", "en"));

  const untranslated = [...english]
    .filter(([path, text]) => spanish.get(path) === text && !SAME_IN_BOTH.has(text))
    .map(([path, text]) => `  ${path}: ${JSON.stringify(text)}`);

  assert.deepEqual(
    untranslated,
    [],
    "estos valores son idénticos al catálogo español — ¿quedaron sin traducir?\n" +
      untranslated.join("\n") +
      "\n(si de verdad se escriben igual en los dos idiomas, agrégalos a SAME_IN_BOTH con su razón)"
  );

  const source = stripComments(
    readFileSync(new URL("../src/lib/i18n/messages.en.ts", import.meta.url), "utf8")
  );
  assert.equal(
    /\b(TODO|FIXME|XXX|PENDIENTE)\b/.test(source),
    false,
    "messages.en.ts tiene un TODO: hay traducciones sin terminar"
  );
});

/**
 * El bug que originó `format.ts`, convertido en prueba.
 *
 * Había dos copias de `money()` y las dos tenían clavado `es-CL`, que agrupa los
 * miles con punto: 1500 USD se dibujaba "1.500 USD", que un angloparlante lee
 * como 1,5. No es cosmético, es un número equivocado.
 */
test("money agrupa según el idioma y no según quién lo escribió", () => {
  const source = readFileSync(new URL("../src/lib/i18n/format.ts", import.meta.url), "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "cjs" });
  const module = { exports: {} };
  new Function("module", "exports", "require", code)(module, module.exports, () => ({}));
  const { money } = module.exports;

  assert.equal(money(1500, "USD", "es"), "1.500 USD");
  assert.equal(money(1500, "USD", "en"), "1,500 USD");

  // Sin decimales cuando no los necesita: era deliberado y se conserva.
  assert.equal(money(94, "USD", "en"), "94 USD");
  assert.equal(money(94.5, "USD", "en"), "94.50 USD");

  // CLP no tiene centavos. Antes mostraba "1.234,56 CLP", que no existe.
  assert.equal(money(1234.56, "CLP", "es"), "1.235 CLP");
  assert.equal(money(1234.56, "CLP", "en"), "1,235 CLP");
});
