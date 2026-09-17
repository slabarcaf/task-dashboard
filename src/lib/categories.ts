/**
 * Category identifiers versus category labels.
 *
 * The string stored in `tasks.tipo` is an **identifier**, not display text. The
 * canonical set mirrors PRESET_CATEGORIES in the bot's melissa.js, and the live
 * data is overwhelmingly Spanish (237 "Otros", 108 "Recruiting", 49 "Finanzas").
 *
 * Someone using the app in English sees a translated label; what gets written to
 * the database is still the identifier. That is the whole trick — it lets the UI
 * be bilingual without the vocabulary forking, which is exactly what happened
 * when an English list was offered alongside the Spanish one and left stray
 * "University" and "Job" rows behind.
 *
 * Categories a user invents are shown exactly as typed. Nobody expects the
 * "Viajes" they created to appear as "Travel".
 */

export const CANONICAL_CATEGORIES = [
  "Work",
  "Estudios",
  "Salud",
  "Personal",
  "Side Projects",
  "Finanzas",
  "Networking",
  "Otros"
] as const;

import type { AppLanguage } from "@/lib/language";

export type { AppLanguage } from "@/lib/language";

/**
 * El cubo de "todavía sin clasificar".
 *
 * No es una categoría como las otras: es el destino por omisión de cualquier
 * tarea que no cae en ninguna. `page.tsx` ya lo mete en la lista que dibuja pase
 * lo que pase, `defaultCategory` lo busca antes que a nadie, y los presets del
 * bot lo incluyen. Está acá para que todo eso deje de ser un string suelto
 * repetido en cinco archivos.
 */
export const FALLBACK_CATEGORY = "Otros";

const CATEGORY_LABELS: Record<string, Record<AppLanguage, string>> = {
  Work: { es: "Trabajo", en: "Work" },
  Estudios: { es: "Estudios", en: "Studies" },
  Salud: { es: "Salud", en: "Health" },
  Personal: { es: "Personal", en: "Personal" },
  "Side Projects": { es: "Proyectos", en: "Side projects" },
  Finanzas: { es: "Finanzas", en: "Finances" },
  Networking: { es: "Networking", en: "Networking" },
  Otros: { es: "Otros", en: "Other" },
  // Identifiers that predate the canonical set and still hold real tasks.
  Recruiting: { es: "Recruiting", en: "Recruiting" },
  Clases: { es: "Clases", en: "Classes" },
  Ayudantias: { es: "Ayudantías", en: "Teaching assistant" },
  "Golf club": { es: "Golf club", en: "Golf club" }
};

/** Display name for a stored identifier. Unknown ones are shown verbatim. */
export function categoryLabel(tipo: string, language: AppLanguage = "es"): string {
  const entry = CATEGORY_LABELS[String(tipo || "").trim()];
  return entry ? entry[language] : String(tipo || "").trim();
}

/**
 * Map a label the user may have seen back to its stored identifier, so a form
 * that displays "Finances" still writes "Finanzas". Falls through unchanged for
 * anything it does not recognise, which is what custom categories need.
 */
export function categoryIdentifier(input: string): string {
  const value = String(input || "").trim();
  if (!value) return value;
  if (CATEGORY_LABELS[value]) return value; // already an identifier
  const lower = value.toLowerCase();
  for (const [id, labels] of Object.entries(CATEGORY_LABELS)) {
    if (labels.es.toLowerCase() === lower || labels.en.toLowerCase() === lower) return id;
  }
  return value;
}
