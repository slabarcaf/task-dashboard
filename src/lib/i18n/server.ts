/**
 * Lectura de la cookie de idioma en el servidor. **Solo para el layout.**
 *
 * `cookies()` vuelve dinámico todo lo que la llame, y por eso está aislada acá:
 * importarla desde `index.ts` arrastraría `next/headers` a cada componente de
 * cliente que pida un texto.
 */

import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeLanguage, type AppLanguage } from "@/lib/i18n";

export function readLanguageCookie(): AppLanguage {
  return normalizeLanguage(cookies().get(LANG_COOKIE)?.value);
}
