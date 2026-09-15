/**
 * El idioma de la interfaz.
 *
 * ⚠️ Este archivo lo importan componentes de cliente **y** el layout de
 * servidor, así que no puede importar `next/headers` ni nada de `node:`. La
 * lectura de la cookie en el servidor vive en `./server.ts`.
 *
 * `AppLanguage` se re-exporta desde `categories.ts` a propósito: es el mismo
 * idioma que decide `categoryLabel`, y dos definiciones del mismo tipo son cómo
 * terminan discrepando.
 */

import { es, type Messages } from "@/lib/i18n/messages.es";
import { en } from "@/lib/i18n/messages.en";
import { DEFAULT_LANGUAGE, type AppLanguage } from "@/lib/language";

export {
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  normalizeLanguage
} from "@/lib/language";
export type { AppLanguage } from "@/lib/language";
export type { Messages } from "@/lib/i18n/messages.es";

const CATALOGS: Record<AppLanguage, Messages> = { es, en };

export function getMessages(language: AppLanguage): Messages {
  return CATALOGS[language] || CATALOGS[DEFAULT_LANGUAGE];
}
