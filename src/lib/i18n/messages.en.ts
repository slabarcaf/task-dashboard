/**
 * The English catalogue. Its shape is `Messages`, defined by `messages.es.ts` —
 * a missing key, an extra key or a changed signature fails `tsc`, so a half-done
 * translation cannot reach production.
 *
 * What `tsc` cannot see is a value still written in Spanish. That is what
 * `tests/no-spanish-literals.test.mjs` checks here.
 */

import type { Messages } from "@/lib/i18n/messages.es";

export const en: Messages = {
  meta: {
    title: "Sydney",
    description: "Your tasks, on the web and on Telegram."
  },
  language: {
    label: "Language",
    es: "Español",
    en: "English"
  }
};
