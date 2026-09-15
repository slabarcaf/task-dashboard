"use client";

// El QR es un data URL generado en el servidor: `next/image` no puede
// optimizar eso, y lo envolvería en un proxy para nada.
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { TelegramLink, createTelegramLink, getCurrentUser } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { apiErrorText } from "@/lib/i18n/errors";

type TelegramConnectProps = {
  /** Mientras es false se ofrece conectar; cuando pasa a true, se felicita. */
  connected: boolean;
  /** Avisa al padre en cuanto la vinculación se detecta, sin recargar. */
  onConnected?: () => void;
  className?: string;
};

/**
 * El puente a Telegram: un QR para el teléfono que tienes al lado, un enlace
 * tocable para el teléfono en el que ya estás, y el código pelado para cuando
 * ninguno de los dos sirve.
 *
 * Vive aquí y no en Ajustes porque el onboarding lo necesita igual, y este
 * repositorio ya pagó una vez el precio de duplicar marcado: había dos copias de
 * la tarjeta de tarea y la del tablero había perdido dos botones en silencio.
 *
 * **El QR va segundo en el teléfono.** Nadie escanea la pantalla que tiene en la
 * mano. En un computador el QR es el camino bueno —el chat termina en el
 * teléfono, que es donde sirve— y en un teléfono el camino bueno es el enlace,
 * que abre la app directamente. Por eso el orden se invierte con `sm:`, en vez
 * de mostrar lo mismo a los dos y que cada quien se las arregle.
 */
export function TelegramConnect({ connected, onConnected, className }: TelegramConnectProps) {
  const t = useT();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Mientras el QR está a la vista, se pregunta si ya quedó conectado.
   *
   * Sin esto la persona escanea, ve el "listo" en el teléfono, y vuelve a una
   * pantalla que sigue pidiéndole que conecte — y no tiene forma de saber si
   * funcionó salvo recargar. Se detiene sola al conectar y a los tres minutos:
   * un sondeo que nadie apaga es una petición cada tres segundos para siempre.
   */
  useEffect(() => {
    if (!link || connected) return;
    let stop = false;
    const started = Date.now();

    const tick = async () => {
      if (stop || Date.now() - started > 3 * 60 * 1000) return;
      try {
        const user = await getCurrentUser();
        if (!stop && user?.telegramLinked) {
          onConnected?.();
          return;
        }
      } catch {
        // Una respuesta perdida no es motivo para dejar de mirar.
      }
      if (!stop) timer = window.setTimeout(tick, 3000);
    };

    let timer = window.setTimeout(tick, 3000);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [link, connected, onConnected]);

  if (connected) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <span className="rounded-chip border border-ok/30 bg-ok-soft px-3 py-1 text-[12.5px] font-semibold text-ok">
          {t.telegram.connected}
        </span>
        <span className="text-[13px] text-ink-2">{t.telegram.connectedHint}</span>
      </div>
    );
  }

  if (!link) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setLink(await createTelegramLink());
            } catch (e) {
              setError(apiErrorText(t, e));
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-field bg-brand px-5 py-2.5 text-[14.5px] font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? t.telegram.generating : t.telegram.connect}
        </button>
        {error && <p className="mt-3 text-[13px] text-late">{error}</p>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-start", className)}>
      {/* Segundo en el teléfono, primero en el computador. */}
      <img
        src={link.qrDataUrl}
        alt={t.telegram.qrAlt}
        // 192px de QR dibujado para una URL de ~45 caracteres son unos cinco
        // píxeles por módulo, que se escanea cómodo; a 160px quedaba al límite.
        // La placa blanca es explícita para que el modo oscuro no la invierta.
        className="order-2 h-48 w-48 flex-none self-center rounded-card border border-line bg-white p-2 sm:order-1 sm:self-start"
      />

      <div className="order-1 min-w-0 sm:order-2">
        <a
          href={link.deepLink}
          target="_blank"
          rel="noreferrer"
          className="inline-block w-full rounded-field bg-brand px-5 py-3 text-center text-[15px] font-semibold text-brand-ink sm:w-auto sm:py-2.5"
        >
          {t.telegram.openAndConnect}
        </a>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
          <b className="text-ink">{t.telegram.onComputerBold}</b>
          {t.telegram.onComputerRest}
        </p>

        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
          {t.telegram.cannotScanBefore}
          <b className="text-ink-2">@{link.botUsername}</b>
          {t.telegram.cannotScanAfter}
        </p>
        <code className="num mt-1.5 inline-block rounded-field border border-line bg-sunken px-3 py-1.5 text-[13px] font-semibold text-ink">
          /link {link.code}
        </code>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          {t.telegram.codeLifeBefore}
          <b className="text-ink-2">{t.telegram.codeLifeBold}</b>
          {t.telegram.codeLifeAfter}
        </p>
      </div>
    </div>
  );
}
