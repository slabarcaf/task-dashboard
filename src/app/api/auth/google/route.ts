import { NextRequest, NextResponse } from "next/server";
import { createUserSession, crossOriginRefused, originIsTrusted, setSessionCookie, toAuthUser } from "@/lib/server/auth";
import { verifyGoogleCredential } from "@/lib/server/google-auth";
import { linkGoogleIdentity } from "@/lib/server/db";
import { LIMITS, clientIp, consumeRateLimit, tooManyRequests } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

/**
 * La puerta. Sydney es **solo por invitación**.
 *
 * Firmar con Google prueba quién eres, no que tengas permiso para entrar: el
 * permiso es una fila en `users`, y la única cosa que crea filas es la
 * invitación desde `/admin`. Hasta el 2026-09-11 esta ruta creaba la cuenta
 * sola, así que cualquier persona del planeta con una cuenta de Google entraba
 * y, un minuto después, podía gastar la llave de OpenAI en transcripciones.
 *
 * El rechazo es **el mismo** para una dirección nunca invitada que para una
 * invitada y luego borrada. Distinguirlas convertiría esta pantalla en un
 * oráculo para averiguar quién tiene cuenta, que es justo lo que no queremos
 * regalarle a alguien con una lista de correos y paciencia.
 */
export async function POST(request: NextRequest) {
  if (!originIsTrusted()) return crossOriginRefused();
  // Antes de verificar nada: comprobar un ID token es una llamada a Google, así
  // que también cuesta cuando falla.
  const gate = await consumeRateLimit(`signin:${clientIp(request)}`, LIMITS.signIn);
  if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

  try {
    const body = (await request.json()) as { credential?: string };
    const credential = String(body.credential || "").trim();

    if (!credential) {
      return NextResponse.json({ ok: false, error: "Missing credential" }, { status: 400 });
    }

    const verified = await verifyGoogleCredential(credential);
    const user = await linkGoogleIdentity(verified);

    if (!user) {
      console.warn(`[auth] acceso sin invitación rechazado para ${verified.email}`);
      return NextResponse.json(
        {
          ok: false,
          error: "not_invited",
          detail: "Sydney es por invitación. Pídesela a quien te habló de esto."
        },
        { status: 403 }
      );
    }

    const session = await createUserSession(user.id);

    const response = NextResponse.json({ ok: true, user: toAuthUser(user) });

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    // El detalle va al log, no al navegador: el mensaje de una excepción de `pg`
    // trae el SQL, los nombres de las columnas y a veces el host de la conexión.
    console.warn("[auth] falló el ingreso con Google:", error);

    // Una excepción: el correo sin verificar merece decirse. Es el único fallo
    // que deja fuera a alguien cuya cuenta existe y cuya contraseña es correcta,
    // y sin nombrarlo el diagnóstico son horas. Google marca así algunas cuentas
    // de Workspace con el dominio a medio verificar.
    if (error instanceof Error && error.message === "Google email is not verified") {
      return NextResponse.json(
        {
          ok: false,
          error: "email_unverified",
          detail: "Google dice que ese correo no está verificado. Escríbele a quien administra Sydney."
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: false, error: "signin_failed" }, { status: 401 });
  }
}
