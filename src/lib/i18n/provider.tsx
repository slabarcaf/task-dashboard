"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  getMessages,
  normalizeLanguage,
  type AppLanguage,
  type Messages
} from "@/lib/i18n";

/**
 * El idioma de la interfaz, para todo el árbol.
 *
 * Va montado en `layout.tsx` y no en `page.tsx` porque `/ajustes` y `/admin` son
 * rutas hermanas que nunca se renderizan dentro de la portada: el layout es el
 * único ancestro común.
 *
 * Es contexto y no props a propósito. Los ocho componentes que recibían
 * `language` como prop dejaron dos sitios congelados en "es" —`DebtsView` ni
 * siquiera declaraba el prop— porque un prop se puede olvidar. El contexto no
 * tiene ese modo de fallo.
 *
 * ⚠️ **Las funciones de `src/lib/` no leen de acá.** `categoryLabel`,
 * `formatShortDate`, `relativeDueLabel` y `money` siguen siendo puras y
 * recibiendo el idioma por parámetro: están cubiertas por los tests `.mjs` y
 * podrían hacer falta en el servidor. El componente lee `useLanguage()` y se lo
 * pasa.
 */

type I18nValue = {
  language: AppLanguage;
  t: Messages;
  setLanguage: (next: AppLanguage) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

/** La cookie que el servidor ya leyó, reescrita desde el cliente. */
function writeLanguageCookie(language: AppLanguage): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LANG_COOKIE}=${language}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function I18nProvider({
  initialLanguage,
  children
}: {
  initialLanguage: AppLanguage;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);

  // El servidor manda el valor inicial, así que el primer render del cliente
  // coincide y no hay desajuste de hidratación. Esto solo corre cuando el layout
  // se vuelve a renderizar con otra cookie.
  useEffect(() => {
    setLanguageState(initialLanguage);
  }, [initialLanguage]);

  const setLanguage = useCallback((next: AppLanguage) => {
    const normalized = normalizeLanguage(next);
    setLanguageState((current) => {
      // Escribir la cookie en cada llamada, aunque el idioma no cambie: es lo
      // que repara el caso de una cookie ausente o adulterada cuando llega la
      // preferencia de la cuenta.
      writeLanguageCookie(normalized);
      return current === normalized ? current : normalized;
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ language, t: getMessages(language), setLanguage }),
    [language, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Fuera del proveedor se cae al idioma por omisión en vez de lanzar. Un texto en
 * español es un defecto cosmético; una excepción deja la pantalla en blanco, y
 * este contexto envuelve incluso la pantalla de acceso.
 */
function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (context) return context;
  return {
    language: DEFAULT_LANGUAGE,
    t: getMessages(DEFAULT_LANGUAGE),
    setLanguage: () => {}
  };
}

/** Los textos. Se usa como `const t = useT()` y después `t.nav.board`. */
export function useT(): Messages {
  return useI18n().t;
}

/** Para pasárselo a las funciones puras de `src/lib/`. */
export function useLanguage(): AppLanguage {
  return useI18n().language;
}

/**
 * Cambia el idioma del dispositivo. **No escribe en la base**: guardar la
 * preferencia de la cuenta es trabajo de `updatePreferences`, y quien llame a
 * los dos decide el orden.
 */
export function useSetLanguage(): (next: AppLanguage) => void {
  return useI18n().setLanguage;
}
