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
import { useSetLanguage } from "@/lib/i18n/provider";
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
 * the language Sydney answers in, and that is what this changes.
 */
export default function SettingsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed_out">("loading");
  const setLanguage = useSetLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);
      if (!me) return setState("signed_out");
      setPrefs(await getUserPreferences());
      setState("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar.");
      setState("ready");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Parameters<typeof updatePreferences>[0], label: string) => {
    setBusy(label);
    setError(null);
    try {
      const saved = await updatePreferences(patch);
      setPrefs(saved);
      // El idioma es el único ajuste que cambia esta misma pantalla, así que se
      // aplica al confirmar el guardado y no antes: si el servidor lo rechaza,
      // la interfaz no queda en un idioma que la cuenta no tiene.
      if (patch.language) setLanguage(saved.language);
      setNote(`${label} guardado`);
      window.setTimeout(() => setNote(null), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading") return <Shell><p className="text-sm text-ink-2">Cargando…</p></Shell>;

  if (state === "signed_out") {
    return (
      <Shell>
        <p className="text-sm text-ink-2">
          Necesitas iniciar sesión.{" "}
          <Link className="font-semibold text-brand underline" href="/">Ir al acceso</Link>
        </p>
      </Shell>
    );
  }

  const connected = Boolean(user?.telegramLinked);

  return (
    <Shell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Ajustes</h1>
          <p className="mt-1 text-sm text-ink-2">{user?.email}</p>
        </div>
        {/* Grande y con color de marca a propósito: es la única salida de esta
            pantalla, y un enlace gris de 13px pegado al borde es exactamente
            donde alguien se pierde. */}
        <Link
          href="/"
          className="rounded-field bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink shadow-card transition-opacity hover:opacity-90"
        >
          ← Mis tareas
        </Link>
      </div>

      {error && (
        <p className="mb-5 rounded-card border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-5 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          {note}
        </p>
      )}

      {/* ── Telegram ────────────────────────────────────────────────────────
          First on the page on purpose: it is where the product actually
          happens. Everything below only matters once this is connected.      */}
      <Section
        title="Telegram"
        hint="Aquí es donde Sydney vive. La web es para mirar y ordenar; hablar con ella es allá — y desde el teléfono, las notas de voz también: el micrófono de la web solo aparece en el computador."
      >
        {connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-chip border border-ok/30 bg-ok-soft px-3 py-1 text-[12.5px] font-semibold text-ok">
              ✓ Conectado
            </span>
            <a
              href="https://t.me/Melizion_bot"
              target="_blank"
              rel="noreferrer"
              className="rounded-field bg-brand px-4 py-2 text-sm font-semibold text-brand-ink"
            >
              Abrir el chat
            </a>
            <button
              type="button"
              disabled={busy === "Telegram"}
              onClick={async () => {
                setBusy("Telegram");
                setError(null);
                try {
                  await disconnectTelegram();
                  await load();
                  setNote("Telegram desconectado");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo desconectar.");
                } finally {
                  setBusy(null);
                }
              }}
              className="rounded-field border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-2 hover:text-ink"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 max-w-prose text-sm text-ink-2">
              Todavía no has conectado Telegram. Mientras no lo hagas no recibirás los briefs de la
              mañana y la noche, y no puedes escribirle a Sydney.
            </p>
            <TelegramConnect connected={false} onConnected={() => void load()} />
          </>
        )}
      </Section>

      {/* ── Idioma ─────────────────────────────────────────────────────────── */}
      <Section
        title="Idioma"
        hint="El idioma en que Sydney te responde en el chat. No cambia el idioma de la app de Telegram — eso es de tu teléfono."
      >
        <div className="flex gap-2">
          {(["es", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              disabled={busy === "Idioma"}
              onClick={() => void save({ language: code }, "Idioma")}
              className={cn(
                "rounded-field border px-4 py-2 text-sm transition-colors",
                prefs?.language === code
                  ? "border-brand/40 bg-brand-soft font-semibold text-brand"
                  : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
              )}
            >
              {code === "es" ? "Español" : "English"}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Briefs ─────────────────────────────────────────────────────────── */}
      <Section
        title="Tus dos mensajes del día"
        hint="Llegan por Telegram, siempre. No hay versión web de esto a propósito: un resumen que tienes que ir a buscar no es un resumen."
      >
        {!connected && (
          <p className="mb-4 rounded-card border border-amber/30 bg-amber-soft px-3 py-2 text-[13px] text-amber-ink">
            Conecta Telegram arriba para que estos horarios sirvan de algo.
          </p>
        )}
        <div className={cn("flex flex-wrap gap-5", !connected && "opacity-50")}>
          <TimeField
            label="☀ En la mañana"
            value={prefs?.briefMorning ?? ""}
            disabled={!connected || busy === "Briefs"}
            onSave={(value) => void save({ briefMorning: value }, "Briefs")}
          />
          <TimeField
            label="☾ En la noche"
            value={prefs?.briefEvening ?? ""}
            disabled={!connected || busy === "Briefs"}
            onSave={(value) => void save({ briefEvening: value }, "Briefs")}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-ink-3">
          Déjalo vacío para apagar uno de los dos.
        </p>
      </Section>

      {/* ── Zona horaria ───────────────────────────────────────────────────── */}
      <Section title="Zona horaria" hint="Define a qué hora real llegan los briefs y qué día es “hoy”.">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={prefs?.timezone || "America/Los_Angeles"}
            disabled={busy === "Zona horaria"}
            onChange={(event) => void save({ timezone: event.target.value }, "Zona horaria")}
            className="rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
          >
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <span className="num text-[12.5px] text-ink-3">
            {prefs?.timezone ? `ahora son las ${nowIn(prefs.timezone)}` : ""}
          </span>
        </div>
      </Section>

      <Section
        title="Categorías"
        hint="Con estas se agrupan tus tareas, aquí y en Telegram. También aparecen solas cuando creas una tarea con una categoría nueva."
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
                {categoryLabel(option, "es")}
                <button
                  type="button"
                  aria-label={`Quitar ${option}`}
                  title={inUse ? "Tiene que quedar al menos una" : `Quitar ${option}`}
                  disabled={inUse || busy === "Categorías"}
                  onClick={() =>
                    void save(
                      { tipoOptions: (prefs?.tipoOptions || []).filter((item) => item !== option) },
                      "Categorías"
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
            void save({ tipoOptions: [...existing, value] }, "Categorías");
            setNewCategory("");
          }}
          className="flex gap-2"
        >
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Agregar una categoría"
            className="min-w-0 flex-1 rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand/60"
          />
          <button
            type="submit"
            disabled={!newCategory.trim() || busy === "Categorías"}
            className="rounded-field border border-line px-3 py-2 text-sm text-ink-2 hover:border-line-2 hover:text-ink disabled:opacity-40"
          >
            Agregar
          </button>
        </form>

        <p className="mt-3 text-[12.5px] text-ink-3">
          Quitar una categoría de esta lista no borra las tareas que ya la tienen; solo deja de
          ofrecerse al crear.
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

function nowIn(timeZone: string): string {
  try {
    return new Date().toLocaleTimeString("es-CL", { timeZone, hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

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
  return (
    <main className="min-h-screen bg-bg px-5 py-9 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-3 border-b border-line pb-5">
          <Wordmark href="/" />
          <span className="rounded-chip border border-line bg-sunken px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            ajustes
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}
