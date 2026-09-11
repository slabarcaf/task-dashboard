import { NextRequest, NextResponse } from "next/server";
import { getBotUserIfAuthorized, getCurrentUserFromCookies } from "@/lib/server/auth";
import { DbUser, getUserPreferencesByUserId } from "@/lib/server/db";
import { buildVoicePrompt } from "@/lib/voicePrompt";
import { LIMITS, consumeRateLimit, tooManyRequests } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
// Un audio de dos minutos tarda varios segundos en transcribirse.
export const maxDuration = 60;

/** Whisper acepta hasta 25 MB. Se corta antes para no gastar la subida entera. */
const MAX_BYTES = 20 * 1024 * 1024;
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

/** Lo que graba el navegador según el navegador. Whisper acepta todos estos. */
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a"
};

async function resolveUser(request: NextRequest): Promise<DbUser | null> {
  return (await getCurrentUserFromCookies()) || (await getBotUserIfAuthorized(request));
}

/**
 * Transcribe una nota de voz con el mismo Whisper que usa el bot en Telegram.
 *
 * Devuelve **texto, no una tarea**. Quien grabó tiene que poder leer lo que se
 * entendió antes de que se convierta en algo: Whisper se equivoca, y una tarea
 * creada en silencio a partir de una frase mal oída es peor que no tener voz.
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // El único camino de la app que cuesta dinero por llamada. El límite es por
  // persona, no por IP: la cuenta es lo que paga, y compartir wifi no debería
  // costarle la voz a nadie.
  const gate = await consumeRateLimit(`transcribe:${user.id}`, LIMITS.transcribe);
  if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Se distingue de un fallo real para que la interfaz pueda decir qué falta
    // en vez de "algo salió mal".
    return NextResponse.json(
      { ok: false, error: "not_configured", detail: "Falta OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ ok: false, error: "No llegó ningún audio." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La nota es demasiado larga." }, { status: 413 });
  }

  const prefs = await getUserPreferencesByUserId(user.id);
  const baseType = (audio.type || "audio/webm").split(";")[0];
  const extension = EXTENSIONS[baseType] || "webm";

  const upstream = new FormData();
  upstream.append("file", audio, `nota.${extension}`);
  upstream.append("model", "whisper-1");
  upstream.append("prompt", buildVoicePrompt(prefs.language, prefs.tipoOptions));
  // Sin pista de idioma Whisper autodetecta, que es lo correcto mientras la
  // preferencia sea la que es: alguien en español puede dictar un nombre en
  // inglés sin que se le traduzca.
  if (prefs.language === "es" || prefs.language === "en") {
    upstream.append("language", prefs.language);
  }

  // La API de OpenAI no trae deadline propio. Sin esto, una llamada colgada deja
  // al usuario con el botón girando para siempre.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      console.warn(`[transcribe] whisper HTTP ${response.status}: ${detail}`);
      return NextResponse.json(
        { ok: false, error: "No se pudo transcribir." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { text?: string };
    return NextResponse.json({ ok: true, text: String(data.text || "").trim() });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { ok: false, error: aborted ? "La transcripción tardó demasiado." : "No se pudo transcribir." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timer);
  }
}
