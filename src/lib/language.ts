/**
 * El idioma, como tipo y como valor. **Puro a propósito.**
 *
 * Vive solo, y no dentro de `i18n/index.ts`, porque lo necesitan sitios que no
 * deben arrastrar los catálogos: `db.ts` normaliza lo que trae la columna,
 * `mail.ts` elige la versión del correo, y ninguno de los dos tiene por qué
 * cargar 15KB de textos de interfaz para decidir entre dos letras.
 *
 * Una sola definición: `categories.ts` y `i18n/` la re-exportan. Dos
 * definiciones del mismo tipo son cómo terminan discrepando.
 */

export type AppLanguage = "es" | "en";

/** Español mientras no se sepa otra cosa. Es el idioma del producto hoy. */
export const DEFAULT_LANGUAGE: AppLanguage = "es";

/**
 * Preferencia de presentación, no una credencial: la escribe el cliente (el
 * selector de la pantalla de acceso, y la reconciliación cuando llegan las
 * preferencias de la cuenta), así que **no** es httpOnly. Es una cookie y no
 * `localStorage` porque el layout es de servidor: es el único mecanismo que deja
 * pintar el idioma correcto a la primera en vez de corregirlo después.
 */
export const LANG_COOKIE = "sydney-lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cualquier cosa que no sea "es" o "en" cae al idioma por omisión.
 *
 * Hace falta de verdad: ni la columna de Postgres ni la de SQLite tienen un
 * CHECK, así que el único sitio que valida es la ruta de preferencias. Una fila
 * vieja, una escritura del bot o una cookie tocada a mano pueden traer otra cosa.
 */
export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  const lower = String(value || "").trim().toLowerCase();
  return lower === "en" ? "en" : lower === "es" ? "es" : DEFAULT_LANGUAGE;
}
