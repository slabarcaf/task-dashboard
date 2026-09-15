"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";

type VoiceButtonProps = {
  disabled?: boolean;
  /** Recibe el texto transcrito. No crea nada: quien grabó lo revisa antes. */
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
};

type State = "idle" | "recording" | "transcribing";

/** Dos minutos. Más que eso ya no es una nota de voz, es un monólogo. */
const MAX_MS = 120_000;
/** Bajo esto no hubo intención de grabar: fue un clic. */
const MIN_MS = 350;

/**
 * Mantener pulsado para grabar, soltar para transcribir — como WhatsApp.
 *
 * **Solo aparece en computador.** En el teléfono la nota de voz se le manda a
 * Sydney por Telegram, que es la misma transcripción por un camino más robusto.
 *
 * También funciona con un clic corto: pulsar y soltar rápido deja la grabación
 * **abierta** hasta el siguiente clic. Mantener el dedo apretado treinta
 * segundos es incómodo en un escritorio, y la alternativa no cuesta nada.
 *
 * El resultado entra al campo de texto, no crea la tarea. Whisper se equivoca, y
 * una tarea creada en silencio desde una frase mal oída es peor que no tener
 * voz: la persona la descubre el día que el recordatorio no llega.
 */
export function VoiceButton({ disabled, onTranscript, onError }: VoiceButtonProps) {
  const t = useT();
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  // Empieza en false y se enciende tras comprobar: así el teléfono no ve
  // aparecer y desaparecer un botón que no le corresponde.
  const [supported, setSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const latchedRef = useRef(false);
  const stopTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Dos condiciones, por razones distintas.
    //
    // La técnica: getUserMedia no existe sin HTTPS (localhost aparte) y
    // MediaRecorder falta en navegadores viejos. Un botón que no puede funcionar
    // no debería estar.
    const canRecord =
      typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

    // Y la de producto: **solo en computador**. En el teléfono ya está Telegram,
    // que graba mejor, no depende de MediaRecorder en Safari — que en iOS graba
    // en audio/mp4 y es el camino más frágil de los dos — y es donde la persona
    // ya está hablándole a Sydney. Ofrecer aquí una versión peor de algo que
    // tiene al lado no es ofrecer una opción, es repartir la misma función en
    // dos sitios y hacer que ninguno sea el bueno.
    const query = window.matchMedia("(min-width: 640px) and (pointer: fine)");
    const apply = () => setSupported(canRecord && query.matches);
    apply();

    // Se escucha el cambio: una ventana que se agranda, o un iPad al que le
    // enchufan un teclado con trackpad.
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const cleanup = useCallback(() => {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    stopTimerRef.current = null;
    tickRef.current = null;
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "nota");
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          text?: string;
          error?: string;
          detail?: string;
        };

        if (!response.ok || !data.ok) {
          onError(
            data.error === "not_configured"
              ? t.voice.notConfigured
              : data.error || t.voice.failed
          );
          return;
        }
        if (!data.text) {
          onError(t.voice.nothingHeard);
          return;
        }
        onTranscript(data.text);
      } catch {
        onError(t.voice.failed);
      } finally {
        setState("idle");
      }
    },
    [onError, onTranscript, t]
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle" || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const held = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        cleanup();
        setElapsed(0);
        setState("idle");
        // Un toque accidental no se manda a transcribir: cuesta dinero y
        // devuelve ruido.
        if (held < MIN_MS || blob.size === 0) return;
        void transcribe(blob);
      };

      recorder.start();
      setState("recording");
      tickRef.current = window.setInterval(
        () => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)),
        250
      );
      stopTimerRef.current = window.setTimeout(stop, MAX_MS);
    } catch (error) {
      const denied = error instanceof Error && /denied|NotAllowed/i.test(error.name + error.message);
      onError(
        denied ? t.voice.micDenied : t.voice.micFailed
      );
      setState("idle");
    }
  }, [cleanup, disabled, onError, state, stop, t, transcribe]);

  if (!supported) return null;

  const recording = state === "recording";
  const busy = state === "transcribing";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-label={recording ? t.voice.releaseAria : t.voice.record}
      title={recording ? t.voice.releaseTitle : t.voice.holdTitle}
      // pointer* y no mouse*: cubre dedo, mouse y lápiz con un solo camino.
      onPointerDown={(event) => {
        event.preventDefault();
        latchedRef.current = false;
        void start();
      }}
      onPointerUp={() => {
        // Un toque corto deja la grabación abierta; el siguiente clic la cierra.
        if (Date.now() - startedAtRef.current < MIN_MS && state === "recording") {
          latchedRef.current = true;
          return;
        }
        stop();
      }}
      onPointerLeave={() => {
        if (!latchedRef.current) stop();
      }}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (recording) stop();
          else void start();
        }
      }}
      className={cn(
        "relative grid h-8 w-8 flex-none place-items-center rounded-full text-[15px] transition-colors",
        recording
          ? "animate-pulse bg-late text-white"
          : busy
            ? "bg-sunken text-ink-3"
            : "text-ink-3 hover:bg-raised hover:text-ink"
      )}
    >
      {busy ? <span className="text-[12px]">…</span> : recording ? "■" : "🎙"}
      {recording && (
        <span className="num absolute -bottom-5 rounded-chip bg-late px-1.5 text-[10.5px] font-semibold text-white">
          {elapsed}s
        </span>
      )}
    </button>
  );
}
