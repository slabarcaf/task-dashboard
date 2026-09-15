/**
 * De un código de error a una frase en el idioma de quien mira.
 *
 * Las rutas devuelven **códigos estables**, no frases. Tres razones, y la
 * tercera es la que decide:
 *
 *  1. El bot de Telegram llama estas mismas rutas y tiene su propio
 *     diccionario. Un código sirve a los dos; una frase traducida en el
 *     servidor sirve a uno solo.
 *  2. `parseJsonOrThrow` ya era un embudo único en el cliente, que es el lugar
 *     natural para traducir.
 *  3. **La mitad de estos errores se devuelven antes de resolver al usuario.**
 *     Cada 401 sale arriba del handler, donde no hay `prefs.language` que leer.
 *     Traducir en el servidor exigiría leer una cookie en cada ruta.
 */

import type { Messages } from "@/lib/i18n";
import { ApiError } from "@/lib/api";

/** El mismo cuadro, cuando ya se tiene el código pelado y no una excepción. */
export function apiErrorCodeText(t: Messages, code: string | undefined | null): string | null {
  const table = t.apiErrors as Record<string, string | undefined>;
  return (code && table[code]) || null;
}

export function apiErrorText(t: Messages, error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  if (code) {
    // La tabla está tipada con llaves literales para que `tsc` obligue la
    // paridad entre catálogos; indexar con un código cualquiera necesita este
    // ensanchamiento, y por eso hay un respaldo.
    const table = t.apiErrors as Record<string, string | undefined>;
    const known = table[code];
    if (known) return known;
  }
  // Un código que nadie tradujo no se le muestra a nadie: iría en inglés de
  // máquina ("missing_patch"), que es peor que una frase honesta y vaga.
  return t.errors.generic;
}

/**
 * ¿La ruta dijo que no hay sesión?
 *
 * Existe porque `useTasks` lo decidía comparando el **texto** del error contra
 * "Unauthorized" —`message === "Unauthorized"`— y traducir ese texto habría
 * dejado de cerrar la sesión, en silencio: la persona seguiría viendo una lista
 * que el servidor ya no le entrega, sin volver nunca a la pantalla de acceso.
 *
 * Comparar contra un código, o contra el 401, es lo que había que hacer desde
 * el principio: un mensaje es para leerlo, no para decidir con él.
 */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.code === "Unauthorized");
}

/**
 * ¿La ruta dijo que esta cuenta no manda aquí?
 *
 * Mismo motivo que `isUnauthorized`, y el mismo bug esperando: la pantalla de
 * admin decidía si mostrar "esto no es para ti" con
 * `/forbidden/i.test(message)`. Traducido el mensaje, esa prueba nunca vuelve a
 * dar verdadero y en lugar de la pantalla explicada sale un aviso de error rojo.
 */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.code === "Forbidden");
}
