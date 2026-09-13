"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sydney-theme";

/**
 * Claro u oscuro, recordado en este dispositivo.
 *
 * Se escribe en `data-theme` del <html>, que es de donde leen tanto globals.css
 * como la variante `dark:` de Tailwind. `localStorage` puede lanzar excepción en
 * un navegador con el almacenamiento bloqueado, así que cada lectura y escritura
 * va con `try`/`catch`: fallar ahí significa que el tema no se recuerda, nunca
 * que la pantalla se rompe.
 *
 * **Oscuro por omisión desde 2026-09-13**, y deliberadamente *sin* consultar
 * `prefers-color-scheme`. Consultarlo suena más educado, pero significaba que
 * alguien con el sistema en claro —que es la mayoría— nunca veía el tema que
 * este producto tiene por defecto. La elección guardada sigue ganando sobre todo.
 */
export const DEFAULT_THEME: "light" | "dark" = "dark";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(DEFAULT_THEME);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const initial = stored === "dark" || stored === "light" ? stored : DEFAULT_THEME;
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // A browser that refuses storage still gets the theme, just not the memory.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
