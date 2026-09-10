"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

type SignInScreenProps = {
  clientId: string;
  isSigningIn: boolean;
  error: string | null;
  onCredential: (response: { credential?: string }) => void;
  onScriptError: (message: string) => void;
};

/**
 * The only screen anyone sees without a session.
 *
 * ⚠️ The ref and the effect that renders Google's button live *here*, in the
 * same component as the div they target, and that is not an accident. The
 * effect bails when `googleButtonRef.current` is null and its dependencies do
 * not change when the div appears later, so if the div is ever placed behind a
 * condition, an entrance animation, a Suspense boundary or a child that mounts a
 * tick later, the effect runs against an empty ref and never runs again: the
 * button simply never appears, with nothing in the console. See DESIGN.md.
 *
 * Google injects an iframe, so the button cannot be styled from here — only the
 * options below reach it, and `width` is a fixed pixel value. The layout is
 * built around its 280px, it does not paint it.
 */
export function SignInScreen({
  clientId,
  isSigningIn,
  error,
  onCredential,
  onScriptError
}: SignInScreenProps) {
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!clientId) return;
    if (!googleButtonRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential });
      // Clears anything already inside the ref's div — which is why the loading
      // text is a sibling of that div and not a child of it.
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        locale: "es",
        width: 280
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => onScriptError("No se pudo cargar el acceso con Google.");
    document.head.appendChild(script);

    // `script.remove()` rather than `head.removeChild(script)`: the second
    // throws NotFoundError if the node is already gone, which happens when the
    // screen mounts and unmounts a couple of times in a row.
    return () => script.remove();
  }, [clientId, onCredential, onScriptError]);

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section
        className="relative flex flex-col overflow-hidden px-7 py-12 text-white sm:px-12 lg:px-14 lg:py-14"
        style={{ background: "linear-gradient(155deg, var(--night-2) 0%, var(--night-1) 62%)" }}
      >
        {/* El amanecer: un resplandor cálido bajo el horizonte del panel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
          style={{
            background:
              "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(232,145,43,.34), rgba(232,145,43,.09) 45%, transparent 72%)"
          }}
        />

        <div className="relative flex flex-1 flex-col">
          <Wordmark tone="night" />

          <h1 className="mt-12 max-w-[16ch] font-display text-[clamp(30px,3.6vw,44px)] font-bold leading-[1.12] tracking-tight">
            Tu vida <span className="text-amber">entera</span>, en una sola lista.
          </h1>
          <p className="mt-5 max-w-[40ch] text-[15.5px] leading-relaxed text-[#B9BEE0]">
            Lo que tienes que hacer hoy, lo que dejaste para el viernes y lo que llevas tres semanas
            postergando. Sydney lo junta todo en un solo lugar y te lo devuelve ordenado, para que no
            tengas que acordarte de nada.
          </p>

          {/* El arco del día. Muestra las 7:00 y las 20:00 porque esa es la
              estructura real del producto, no un adorno. */}
          <div className="mt-auto max-w-[400px] border-t border-white/15 pt-5">
            <p className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8E95C4]">
              Y te escribe dos veces al día
            </p>
            <div className="relative h-[3px] rounded-sm bg-[linear-gradient(90deg,var(--amber)_0%,#8FA0E8_48%,#4E5AA8_100%)]">
              <span className="absolute left-[47%] top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,.16)]" />
            </div>
            <div className="mt-3 flex justify-between text-[12.5px] text-[#A2A9D4]">
              <span className="num">☀ 7:00 · lo que viene hoy</span>
              <span className="num">☾ 20:00 · cierre del día</span>
            </div>
            <p className="mt-5 text-[12.5px] text-[#767DA8]">
              Aquí o en Telegram, da igual: es la misma cuenta y la misma lista.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center bg-surface px-7 py-14 sm:px-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-[25px] font-semibold tracking-tight text-ink">
            Entra a tu cuenta
          </h2>
          <p className="mt-1.5 text-[14.5px] text-ink-2">Tus tareas son privadas. Nadie más las ve.</p>

          {error && (
            <p className="mt-6 rounded-card border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
              {error}
            </p>
          )}

          <div className="mt-7">
            {clientId ? (
              <>
                <div ref={googleButtonRef} />
                {/* Hermano del div del ref, nunca hijo: renderButton lo vacía. */}
                <p className="mt-3 h-5 text-sm text-ink-3" aria-live="polite">
                  {isSigningIn ? "Entrando…" : ""}
                </p>
              </>
            ) : (
              <p className="rounded-card border border-late/30 bg-late-soft px-4 py-3 text-sm text-late">
                Falta <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>. El acceso no
                puede funcionar sin esa variable.
              </p>
            )}
          </div>

          <p className="mt-6 max-w-[36ch] text-[12.5px] leading-relaxed text-ink-3">
            Al continuar aceptas que Sydney guarde tus tareas para mostrártelas. La sesión dura 15
            días.
          </p>
        </div>
      </section>
    </main>
  );
}

/** El logotipo. `night` sobre el panel oscuro, `day` sobre superficie clara. */
export function Wordmark({
  tone = "day",
  hideWordOnMobile = false
}: {
  tone?: "day" | "night";
  hideWordOnMobile?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          tone === "night"
            ? "grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[linear-gradient(150deg,var(--amber),#C9701A)] font-display text-base font-bold text-[#20130A]"
            : "grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[linear-gradient(150deg,var(--brand),#2A35A0)] font-display text-base font-bold text-white"
        }
      >
        S
      </span>
      <b
        className={cn(
          "font-display text-[17px] tracking-tight",
          tone === "night" ? "text-white" : "text-ink",
          // En el encabezado de la app la palabra se esconde en pantallas
          // angostas: la marca sola ya identifica, y esos 60px son la
          // diferencia entre un encabezado de una fila y uno de dos.
          hideWordOnMobile && "hidden sm:block"
        )}
      >
        Sydney
      </b>
    </div>
  );
}
