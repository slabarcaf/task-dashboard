"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SignInScreen";
import { TelegramConnect } from "@/components/TelegramConnect";
import {
  disconnectTelegram,
  getCurrentUser,
  getUserPreferences,
  updatePreferences
} from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { categoryHue } from "@/lib/categoryColor";
import { cn } from "@/lib/cn";
import { useLanguage, useSetLanguage, useT } from "@/lib/i18n/provider";
import { apiErrorText } from "@/lib/i18n/errors";
import { timeInZone } from "@/lib/i18n/format";
import { AuthUser, UserPreferences } from "@/lib/types";

/**
 * Ajustes.
 *
 * The shape of this screen follows one decision: **the web is a door to
 * Telegram, not a copy of it.** So the Telegram section does not try to render a
 * chat, a message list or a preview — it hands you a QR for the phone in your
 * hand, a tappable link for the phone you are already holding, and the bare code
 * for when neither works. Everything else on this page is a setting that governs
 * what happens *inside that chat*.
 *
 * Which is also why the language control says what it says. We cannot change the
 * language of the Telegram app — that is the person's phone. What we control is
 * the app, and the language Sydney answers in.
 */

/**
 * La llave de cada ajuste. **Estable y en inglés a propósito.**
 *
 * Antes se usaba el rótulo visible como llave del estado `busy`
 * (`busy === "Idioma"`), lo que funcionaba sólo mientras hubiera un idioma:
 * traducido, el botón de guardar nunca se habría deshabilitado. Una llave que
 * cambia con el idioma no es una llave.
 */
type SettingKey = "telegram" | "language" | "briefs" | "timezone" | "categories";

/**
 * Lo que dice el aviso verde, guardado como **llave y no como texto ya
 * dibujado**.
 *
 * Es la misma regla que `SettingKey`, y esta la pagó el idioma: guardar el
 * string hacía que cambiar a español dejara un "Language saved" en inglés sobre
 * una pantalla ya traducida. El `t` del closure era el de antes del cambio.
 * Un texto guardado en el estado es un texto congelado en el idioma de ese
 * instante; la llave se dibuja con el catálogo vigente.
 */
type Note = { kind: "saved"; setting: SettingKey } | { kind: "disconnected" };
export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed_out">("loading");
  const t = useT();
  const language = useLanguage();
  const setLanguage = useSetLanguage();
  const [busy, setBusy] = useState<SettingKey | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);
      if (!me) return setState("signed_out");
      const loaded = await getUserPreferences();
      setPrefs(loaded);
      // La misma reconciliación que hace la portada. Hace falta acá también:
      // esta ruta se puede abrir directo, y sin esto una cookie desfasada
      // dejaría la pantalla en un idioma que la cuenta no tiene hasta que
      // alguien pase por "/".
      setLanguage(loaded.language);
      setState("ready");
    } catch (loadError) {
      setError(apiErrorText(t, loadError));
      setState("ready");
    }
  }, [setLanguage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** El rótulo del aviso "X guardado", por llave. */
  const settingTitle: Record<SettingKey, string> = {
    telegram: t.settings.telegramTitle,
    language: t.settings.languageTitle,
    briefs: t.settings.briefsTitle,
    timezone: t.settings.timezoneTitle,
    categories: t.settings.categoriesTitle
  };

  const save = async (patch: Parameters<typeof updatePreferences>[0], key: SettingKey) => {
    setBusy(key);
    setError(null);
    try {
      const saved = await updatePreferences(patch);
      setPrefs(saved);
      // El idioma es el único ajuste que cambia esta misma pantalla, así que se
      // aplica al confirmar el guardado y no antes: si el servidor lo rechaza,
      // la interfaz no queda en un idioma que la cuenta no tiene.
      if (patch.language) setLanguage(saved.language);
      setNote({ kind: "saved", setting: key });
      window.setTimeout(() => setNote(null), 2500);
    } catch (saveError) {
      setError(apiErrorText(t, saveError));
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading")
    return (
      <Shell>
        <p className="text-sm text-ink-2">{t.settings.loading}</p>
      </Shell>
    );

  if (state === "signed_out") {
    return (
      <Shell>
        <p className="text-sm text-ink-2">
          {t.settings.signedOut}{" "}
          <Link className="font-semibold text-brand underline" href="/">
            {t.settings.goToSignIn}
          </Link>
        </p>
      </Shell>
    );
  }

  const connected = Boolean(user?.telegramLinked);

  return (
    <Shell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{t.settings.title}</h1>
          <p className="mt-1 text-sm text-ink-2">{user?.email}</p>
        </div>
        {/* Grande y con color de marca a propósito: es la única salida de esta
            pantalla, y un enlace gris de 13px pegado al borde es exactamente
            donde alguien se pierde. */}
        <Link
          href="/"
          className="rounded-field bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-card transition-opacity hover:opacity-90"
        >
          {t.settings.backToTasks}
        </Link>
      </div>

      {error && (
        <p className="mb-5 rounded-card border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-5 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          {note.kind === "disconnected"
            ? t.settings.disconnected
            : t.settings.saved(settingTitle[note.setting])}
        </p>
      )}

      {/* ── Telegram ────────────────────────────────────────────────────────
          First on the page on purpose: it is where the product actually
          happens. Everything below only matters once this is connected.      */}
      <Section
        title={t.settings.telegramTitle}
        hint={t.settings.telegramHint}
      >
        {connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-chip border border-ok/30 bg-ok-soft px-3 py-1 text-[12.5px] font-semibold text-ok">
              {t.settings.telegramConnected}
            </span>
            <a
              href="https://t.me/Melizion_bot"
              target="_blank"
              rel="noreferrer"
              className="rounded-field bg-brand px-4 py-2 text-sm font-semibold text-brand-ink"
            >
              {t.settings.openChat}
            </a>
            <button
              type="button"
              disabled={busy === "telegram"}
              onClick={async () => {
                setBusy("telegram");
                setError(null);
                try {
                  await disconnectTelegram();
                  await load();
                  setNote({ kind: "disconnected" });
                } catch (e) {
                  setError(apiErrorText(t, e));
                } finally {
                  setBusy(null);
                }
              }}
              className="rounded-field border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-2 hover:text-ink"
            >
              {t.settings.disconnect}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 max-w-prose text-sm text-ink-2">{t.settings.telegramMissing}</p>
            <TelegramConnect connected={false} onConnected={() => void load()} />
          </>
        )}
      </Section>

      {/* ── Idioma ─────────────────────────────────────────────────────────── */}
      <Section
        title={t.settings.languageTitle}
        hint={t.settings.languageHint}
      >
        <div className="flex gap-2">
          {(["es", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              disabled={busy === "language"}
              onClick={() => void save({ language: code }, "language")}
              className={cn(
                "rounded-field border px-4 py-2 text-sm transition-colors",
                prefs?.language === code
                  ? "border-brand/40 bg-brand-soft font-semibold text-brand"
                  : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
              )}
            >
              {t.language[code]}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Briefs ─────────────────────────────────────────────────────────── */}
      <Section
        title={t.settings.briefsTitle}
        hint={t.settings.briefsHint}
      >
        {!connected && (
          <p className="mb-4 rounded-card border border-amber/30 bg-amber-soft px-3 py-2 text-[13px] text-amber-ink">
            {t.settings.briefsNeedTelegram}
          </p>
        )}
        <div className={cn("flex flex-wrap gap-5", !connected && "opacity-50")}>
          <TimeField
            label={t.settings.briefMorning}
            value={prefs?.briefMorning ?? ""}
            disabled={!connected || busy === "briefs"}
            onSave={(value) => void save({ briefMorning: value }, "briefs")}
          />
          <TimeField
            label={t.settings.briefEvening}
            value={prefs?.briefEvening ?? ""}
            disabled={!connected || busy === "briefs"}
            onSave={(value) => void save({ briefEvening: value }, "briefs")}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-ink-3">
          {t.settings.briefsOffHint}
        </p>
      </Section>

      {/* ── Zona horaria ───────────────────────────────────────────────────── */}
      <Section title={t.settings.timezoneTitle} hint={t.settings.timezoneHint}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={prefs?.timezone || "America/Los_Angeles"}
            disabled={busy === "timezone"}
            onChange={(event) => void save({ timezone: event.target.value }, "timezone")}
            className="rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <span className="num text-[12.5px] text-ink-3">
            {prefs?.timezone ? t.settings.timeNow(timeInZone(prefs.timezone, language)) : ""}
          </span>
        </div>
      </Section>

      <Section
        title={t.settings.categoriesTitle}
        hint={t.settings.categoriesHint}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(prefs?.tipoOptions || []).map((option) => {
            const inUse = (prefs?.tipoOptions?.length || 0) <= 1;
            return (
              <span
                key={option}
                className="cat-chip group inline-flex items-center gap-1.5 rounded-chip border px-3 py-1 text-[12.5px] font-semibold"
                style={{ "--cat-h": categoryHue(option) } as React.CSSProperties}
              >
                {categoryLabel(option, language)}
                <button
                  type="button"
                  aria-label={t.settings.removeCategory(categoryLabel(option, language))}
                  title={
                    inUse
                      ? t.settings.lastCategory
                      : t.settings.removeCategory(categoryLabel(option, language))
                  }
                  disabled={inUse || busy === "categories"}
                  onClick={() =>
                    void save(
                      { tipoOptions: (prefs?.tipoOptions || []).filter((item) => item !== option) },
                      "categories"
                    )
                  }
                  className="opacity-50 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = newCategory.trim();
            if (!value) return;
            const existing = prefs?.tipoOptions || [];
            // Comparación sin distinguir mayúsculas: "finanzas" y "Finanzas" son
            // la misma categoría, y dos filas con el mismo nombre parten las
            // tareas en dos grupos que nadie pidió.
            if (existing.some((item) => item.toLowerCase() === value.toLowerCase())) {
              setNewCategory("");
              return;
            }
            void save({ tipoOptions: [...existing, value] }, "categories");
            setNewCategory("");
          }}
          className="flex gap-2"
        >
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder={t.settings.addCategoryPlaceholder}
            className="min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
          />
          <button
            type="submit"
            disabled={!newCategory.trim() || busy === "categories"}
            className="rounded-field border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-2 hover:text-ink disabled:opacity-40"
          >
            {t.settings.addCategory}
          </button>
        </form>

        <p className="mt-3 text-[12.5px] text-ink-3">
          {t.settings.categoriesFootnote}
        </p>
      </Section>
    </Shell>
  );
}

/** A short, honest list. Enough for the people who actually use this. */
const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Mexico_City",
  "America/Bogota",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC"
];


function TimeField({
  label,
  value,
  disabled,
  onSave
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-3">
        {label}
      </span>
      <input
        type="time"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onSave(draft)}
        className="num rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
      />
    </label>
  );
}

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 rounded-panel border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {hint && <p className="mb-4 mt-1 max-w-prose text-[13px] leading-relaxed text-ink-2">{hint}</p>}
      {children}
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <main className="min-h-screen bg-bg px-5 py-9 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-3 border-b border-line pb-5">
          <Wordmark href="/" />
          <span className="rounded-chip border border-line bg-sunken px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {t.settings.eyebrow}
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}
