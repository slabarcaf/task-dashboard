"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sydney-theme";

/**
 * Light or dark, remembered on this device.
 *
 * Written to `data-theme` on <html>, which is what globals.css and Tailwind's
 * `dark:` variant both key off. localStorage can throw outright in a locked-down
 * browser, so every read and write is guarded and a failure just means the theme
 * does not persist — never a blank screen.
 */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
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
