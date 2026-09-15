/**
 * Números, plata y horas. Un solo lugar.
 *
 * Existe porque había dos copias de `money()` —una en `DebtsView` y otra en
 * línea dentro de `OnboardingScreen`— y las dos tenían clavado `es-CL`. Eso no
 * es cosmético: 1500 sale "1.500", que un angloparlante lee como 1,5.
 *
 * ⚠️ **`formatShortDate` y `relativeDueLabel` NO se mudan acá.** Siguen hechas a
 * mano en `src/lib/date.ts` porque existen para calzar con `fmtDate` del bot en
 * `tasks-mcp.js`; reemplazarlas por `Intl` desincroniza la web y Telegram, que
 * es justo la falla que vinieron a evitar.
 */

import type { AppLanguage } from "@/lib/i18n";

export function localeOf(language: AppLanguage): string {
  return language === "en" ? "en-US" : "es-CL";
}

/**
 * Monedas sin centavos. No es la lista completa de ISO 4217 — es la que puede
 * aparecer acá más las obvias, y agregarle una es una línea.
 */
const ZERO_DECIMAL = new Set(["CLP", "JPY", "KRW", "COP", "PYG", "ISK", "VND"]);

/**
 * "94 USD", "1,500 USD", "1.500 CLP".
 *
 * Se formatea **solo el número** con `Intl`, no con `style: "currency"`. El
 * diseño de la app es número-espacio-código; `style:"currency"` da "$94.00" en
 * en-US y "94 US$" en es-CL, o sea tres formas distintas para una misma fila.
 * Lo que sí arregla `Intl` es la agrupación de miles, que es el bug real.
 *
 * Sin decimales cuando no los necesita: "94 USD" y no "94.00 USD".
 */
export function money(amount: number, currency: string, language: AppLanguage): string {
  const code = String(currency || "").trim().toUpperCase();
  const maxFrac = ZERO_DECIMAL.has(code) ? 0 : 2;
  const factor = 10 ** maxFrac;
  const rounded = Math.round(Number(amount || 0) * factor) / factor;
  const text = rounded.toLocaleString(localeOf(language), {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : maxFrac,
    maximumFractionDigits: maxFrac
  });
  return code ? `${text} ${code}` : text;
}

/**
 * La hora que es ahora en otra zona. Arregla algo de verdad al traducir: es-CL
 * dibuja 24 horas y en-US dibuja 12 con AM/PM.
 *
 * Una zona horaria inválida lanza, y eso no debe romper la pantalla: el que
 * llama decide qué se ve en su lugar.
 */
export function timeInZone(timeZone: string, language: AppLanguage, fallback = ""): string {
  try {
    return new Date().toLocaleTimeString(localeOf(language), {
      timeZone,
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return fallback;
  }
}

/** "viernes, 5 sept" / "Friday, Sep 5" — una fecha dicha como la diría alguien. */
export function longWeekdayDate(iso: string, language: AppLanguage): string {
  try {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(localeOf(language), {
      weekday: "long",
      day: "numeric",
      month: "short"
    });
  } catch {
    return iso;
  }
}
