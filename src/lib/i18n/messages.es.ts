/**
 * El catálogo en español. **Este archivo define la forma**; `messages.en.ts` la
 * tiene que cumplir, y `tsc` lo obliga.
 *
 * ⚠️ **No le pongas `as const`.** Parece lo correcto y rompe justo lo que
 * queremos: con `as const` cada valor queda fijado a su literal, así que
 * `Messages` exige el texto español y el archivo inglés no compila nunca
 * (`Type '"Today"' is not assignable to type '"Hoy"'`). Un objeto literal normal
 * ensancha los strings a `string` y conserva las firmas de las funciones, que es
 * exactamente la paridad que se busca: falta una llave → TS2741, sobra una →
 * TS2353, cambia la aridad de una interpolación → error en la llamada.
 *
 * ⚠️ Los arreglos se ensanchan a `string[]`, o sea que el largo **no** se
 * verifica. Las listas de largo fijo (los doce meses) se quedan en `date.ts` y
 * no entran acá.
 *
 * Los valores con parámetros son funciones, no plantillas con marcadores. Es el
 * mismo patrón que `OB` en el bot (`melissa.js`), y la razón es que una función
 * puede ramificar —plural, singular, el caso de cero— y una plantilla no.
 *
 * Lo que se guarda en la base **no se traduce acá**: los identificadores de
 * categoría (`Otros`, `Finanzas`), `direction` y `status` de una deuda y
 * `statusFinalOutcome` son valores de cable. Su etiqueta se traduce; el valor
 * viaja intacto. Ver `src/lib/categories.ts`.
 */

export const es = {
  meta: {
    title: "Sydney",
    description: "Tus tareas, en la web y en Telegram."
  },
  language: {
    label: "Idioma",
    es: "Español",
    en: "English"
  }
};

export type Messages = typeof es;
