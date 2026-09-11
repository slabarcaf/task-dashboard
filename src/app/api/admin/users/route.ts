import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/server/auth";
import { isAdminUser } from "@/lib/server/admin";
import { sendInviteEmail } from "@/lib/server/mail";
import { LIMITS, consumeRateLimit, tooManyRequests } from "@/lib/server/rateLimit";
import {
  INVITE_CODE_TTL_MINUTES,
  createTelegramLinkCode,
  createUser,
  findUserByEmail,
  listAdminUserOverview
} from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Cookie session only — never the bot's bearer token.
 *
 * `getBotUserIfAuthorized` resolves a shared secret to the owner account, and
 * the owner is the admin, so accepting it here would turn one static string
 * living in the bot's config.json into a key to everyone's account summary.
 * Admin is a thing a person is signed in as, not a thing a service can hold.
 */
export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // The admin flag is decided here, not in db.ts: which addresses are admin is
  // a deployment question, and the data layer has no business knowing it.
  const users = (await listAdminUserOverview()).map((row) => ({
    ...row,
    isAdminAccount: isAdminUser(row)
  }));
  return NextResponse.json({
    ok: true,
    users,
    viewerId: user.id,
    // Solo si la variable existe, nunca su valor. Sirve para responder "¿por qué
    // no funciona la voz?" sin abrir el panel de Vercel ni adivinar — que es
    // justo lo que costó media hora la primera vez.
    integrations: {
      voice: Boolean(process.env.OPENAI_API_KEY),
      mail: Boolean(process.env.RESEND_API_KEY),
      // Los nombres que la gente pone cuando quiso poner el correcto. Decir
      // "falta OPENAI_API_KEY" mientras existe un OPEN_AI_KEY a un metro es
      // exactamente el error que costó una hora el 2026-09-11: el panel tiene
      // que nombrar la variable que SÍ está, no solo la que falta.
      misnamed: nearMisses(),
      mailFrom: process.env.INVITE_FROM || "onboarding@resend.dev",
      telegramBot: (process.env.NEXT_PUBLIC_TELEGRAM_BOT || "Melizion_bot").replace(/^@/, "")
    }
  });
}

/**
 * Creates an account and invites the person to it.
 *
 * **Esta ruta es ahora el único lugar que crea cuentas.** Desde el 2026-09-11
 * `/api/auth/google` ya no crea ninguna: firmar con Google prueba quién eres, no
 * que puedas entrar. Así que esta fila ya no es solo un nombre puesto por
 * adelantado — es el permiso mismo. Sigue sirviendo además para lo de antes: una
 * fila cuyo último acceso dice "nunca" es cómo se descubre que la invitación
 * nunca llegó.
 *
 * The mail is the real feature, and it only goes out when RESEND_API_KEY is set.
 * When it is not, the response says so and the screen hands over a message to
 * send by hand instead of pretending something was delivered.
 *
 * (Esto era antes "si alguna vez esto fuera control de acceso real, sería una
 * decisión de la ruta de acceso". Lo es desde el 2026-09-11, y la decisión se
 * tomó allá: `linkGoogleIdentity` devuelve null y nadie entra.)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();

  // Deliberately loose: the authority on whether an address works is Google, at
  // sign-in. This only catches a typo that could never be an address at all.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Ese correo no parece válido." }, { status: 400 });
  }

  const gate = await consumeRateLimit(`invite:${user.id}`, LIMITS.invite);
  if (!gate.allowed) return tooManyRequests(gate.retryAfterSeconds);

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
  }

  const created = await createUser({ email, name });

  // La dirección real desde la que llegó esta petición, no una constante que se
  // queda vieja el día que cambie el dominio.
  const origin = request.nextUrl.origin;

  // Las dos puertas en la misma invitación. El código de Telegram ya apunta a
  // esta cuenta, así que quien abra ese enlace queda dentro sin pasar por la web
  // — y es lo que desatasca el camino de invitar por Telegram, que hasta ahora
  // daba 401 porque no había fila en Postgres a la que engancharse.
  const { code } = await createTelegramLinkCode(created.id, INVITE_CODE_TTL_MINUTES);
  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT || "Melizion_bot").replace(/^@/, "");
  const telegramLink = `https://t.me/${botUsername}?start=link_${code}`;

  const mail = await sendInviteEmail({
    to: email,
    appUrl: origin,
    telegramLink,
    invitedBy: user.name || user.email
  });

  return NextResponse.json({
    ok: true,
    user: { id: created.id, email: created.email },
    // La pantalla dice lo que pasó de verdad. Una invitación que el producto
    // afirma haber mandado y no mandó es peor que no tener invitaciones.
    invite: mail.sent
      ? { sent: true as const }
      : { sent: false as const, reason: mail.reason, appUrl: origin, telegramLink }
  });
}

/**
 * Variables presentes cuyo nombre se parece al que hace falta.
 *
 * Solo nombres, nunca valores. Un `OPEN_AI_KEY` junto a un "falta
 * OPENAI_API_KEY" no es un misterio que resolver, es un tipo que corregir — y el
 * panel debería decirlo en vez de dejar a alguien mirando dos pantallas.
 */
function nearMisses(): Array<{ found: string; shouldBe: string }> {
  const expected: Record<string, string[]> = {
    OPENAI_API_KEY: ["OPEN_AI_KEY", "OPENAI_KEY", "OPENAI_APIKEY", "OPEN_AI_API_KEY", "OPENAI"],
    RESEND_API_KEY: ["RESEND_KEY", "RESEND_APIKEY", "RESEND", "RESEND_TOKEN"],
    NEXT_PUBLIC_TELEGRAM_BOT: ["TELEGRAM_BOT", "TELEGRAM_BOT_USERNAME"],
    ADMIN_EMAILS: ["ADMIN_EMAIL"]
  };

  const found: Array<{ found: string; shouldBe: string }> = [];
  for (const [canonical, aliases] of Object.entries(expected)) {
    if (process.env[canonical]) continue;
    for (const alias of aliases) {
      if (process.env[alias]) found.push({ found: alias, shouldBe: canonical });
    }
  }
  return found;
}
