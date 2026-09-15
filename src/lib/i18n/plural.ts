/**
 * Plural y listas — para español e inglés, y para nada más.
 *
 * Es correcto *porque* el par es es/en: los dos idiomas parten en 1 / resto y no
 * tienen dual ni paucal. Un idioma con más categorías (ruso, árabe, polaco) no
 * se arregla agregándole ramas a esto: necesita las categorías de CLDR de
 * verdad, o `Intl.PluralRules`.
 *
 * **No lo generalices antes de tener ese idioma.** Doce líneas honestas valen
 * más que un mini-ICU a medio hacer.
 */

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * "a, b y c" — o "a, b and c". El conector viaja como parámetro porque vive en
 * el catálogo, que es donde se traduce.
 */
export function list(items: string[], and: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}
