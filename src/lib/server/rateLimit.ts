import { rateLimitHit } from "@/lib/server/db";

export type RateVerdict = { allowed: boolean; retryAfterSeconds: number };

/**
 * Los límites, en un solo lugar y con su razón al lado.
 *
 * Fixed window y no sliding, a propósito: una ventana deslizante necesita una
 * fila por golpe, y el punto de esto es costar menos que aquello que protege.
 * El precio es que alguien puede gastar dos ventanas seguidas justo en el
 * borde. Para "que un desconocido no queme la llave de OpenAI" da igual.
 */
export const LIMITS = {
  // Whisper se paga por minuto de audio. Es el único camino de la app que le
  // cuesta dinero real a Santiago por cada llamada.
  transcribe: { limit: 30, windowSeconds: 60 * 60 },
  // Cada invitación es un correo por Resend, y un correo no pedido a una
  // dirección real es lo que quema un dominio.
  invite: { limit: 20, windowSeconds: 24 * 60 * 60 },
  // Generoso a propósito: 561 tareas en seis meses es el uso real. Esto no
  // estorba a nadie que use la app; corta al que la use como ariete.
  writes: { limit: 300, windowSeconds: 60 * 60 },
  // Pre-autenticación y por IP. Verificar un ID token cuesta una llamada a
  // Google, así que no es gratis ni siquiera cuando falla.
  signIn: { limit: 20, windowSeconds: 15 * 60 }
} as const;

/**
 * ⚠️ Falla **abierto** si la base no responde. Un limitador que tumba la app
 * cuando no puede contar es una caída autoinfligida, y todo lo que protege está
 * además detrás de autenticación: es la segunda cerradura, no la primera.
 */
export async function consumeRateLimit(
  key: string,
  policy: { limit: number; windowSeconds: number }
): Promise<RateVerdict> {
  try {
    const { hits, ageSeconds } = await rateLimitHit(key, policy.windowSeconds);
    const allowed = hits <= policy.limit;
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : Math.max(1, policy.windowSeconds - ageSeconds)
    };
  } catch (error) {
    console.warn("[rate-limit] no se pudo contar, se deja pasar:", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * La IP que ve Vercel. `x-forwarded-for` puede venir falsificado por el cliente,
 * pero delante hay un proxy que antepone la real, así que el **primer** valor es
 * el que vale — y tomar el último sería dejar que el cliente elija su cubo.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "desconocida";
}

export function tooManyRequests(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({ ok: false, error: "rate_limited" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds)
      }
    }
  );
}
