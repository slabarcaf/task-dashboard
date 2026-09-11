"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "sydney-telegram-nudge-dismissed";

/**
 * Un aviso chico, en una esquina, hasta que Telegram esté conectado.
 *
 * Una tarjeta de esquina y no una banda a lo ancho: la persona vino a ver sus
 * tareas, y una barra que empuja todo hacia abajo cobra el mismo precio la
 * primera vez que la vigésima.
 *
 * Se puede cerrar, y ahí se calla en ese navegador. Pero **reaparece sola si se
 * limpia el almacenamiento**, y eso está bien: mientras Telegram no esté
 * conectado, la mitad del producto sigue apagada y decirlo una vez no basta.
 */
export function TelegramNudge({ connected }: { connected: boolean }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (connected) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Un navegador que niega el almacenamiento igual ve el aviso.
      dismissed = false;
    }
    setHidden(dismissed);
  }, [connected]);

  if (connected || hidden) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-[min(21rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-4 shadow-float">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-lg leading-none">✈</span>
        <div className="min-w-0 flex-1">
          <b className="block font-display text-[14px] text-ink">Te falta conectar Telegram</b>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
            Ahí es donde le escribes a Sydney y donde llegan tus dos mensajes del día. Es la misma
            cuenta: las mismas tareas y las mismas deudas, en los dos lados.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/ajustes"
              className="rounded-field bg-brand px-3 py-1.5 text-[13px] font-semibold text-brand-ink"
            >
              Conectar
            </Link>
            <button
              type="button"
              onClick={() => {
                setHidden(true);
                try {
                  window.localStorage.setItem(DISMISSED_KEY, "1");
                } catch {
                  // Sin almacenamiento vuelve a aparecer en la próxima carga.
                }
              }}
              className="rounded-field px-2 py-1.5 text-[13px] text-ink-3 hover:text-ink-2"
            >
              Ahora no
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => {
            setHidden(true);
            try {
              window.localStorage.setItem(DISMISSED_KEY, "1");
            } catch {
              // ídem
            }
          }}
          className="-mr-1 -mt-1 flex-none rounded-field px-1.5 py-0.5 text-ink-3 hover:text-ink"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
