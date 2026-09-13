/**
 * Envío de correo, si hay con qué.
 *
 * Este proyecto no tiene servidor de correo propio. En vez de fingir que lo
 * tiene, esto habla con Resend por HTTP cuando `RESEND_API_KEY` está puesta y
 * **dice claramente que no envió nada cuando no lo está**. La pantalla de admin
 * muestra una cosa u otra según lo que pase de verdad: una invitación que el
 * producto dice haber mandado y no mandó es peor que no tener invitaciones.
 *
 * Para encenderlo: crear una cuenta en resend.com, generar una API key y
 * ponerla en Vercel como `RESEND_API_KEY`. Sin dominio propio verificado, Resend
 * solo deja enviar desde `onboarding@resend.dev`, que es el valor por defecto de
 * `INVITE_FROM` — sirve para probar, y para producción conviene un dominio.
 */

export type MailResult =
  | { sent: true }
  | {
      sent: false;
      /**
       * `unverified_domain` es el caso que parece una falla y no lo es: Resend
       * funciona, la llave sirve, y aun así rechaza todo destinatario que no sea
       * el dueño de la cuenta mientras no haya un dominio verificado. Merece un
       * código propio porque la acción que lo arregla no se parece en nada a la
       * de un fallo de red.
       */
      reason: "not_configured" | "unverified_domain" | "failed";
      detail?: string;
    };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

type InviteInput = { to: string; appUrl: string; telegramLink: string; invitedBy: string };

export async function sendInviteEmail(input: InviteInput): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not_configured" };

  const from = process.env.INVITE_FROM || "Sydney <onboarding@resend.dev>";

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: "Te invitaron a Sydney",
        html: inviteHtml(input),
        text: inviteText(input)
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const detail = `HTTP ${response.status} ${body.slice(0, 300)}`;
      console.warn("[mail] Resend rechazó el envío:", detail);

      // Resend contesta 403 con un mensaje sobre "testing emails" / "own email
      // address" cuando se envía desde onboarding@resend.dev a alguien que no es
      // el dueño de la cuenta. Es el estado por omisión de toda cuenta nueva, y
      // sin nombrarlo la pantalla solo dice "no se pudo enviar" — que hace pensar
      // que Resend está roto cuando lo que falta es verificar un dominio.
      const looksUnverified =
        response.status === 403 &&
        /testing|own email|verify a domain|not verified/i.test(body);

      return {
        sent: false,
        reason: looksUnverified ? "unverified_domain" : "failed",
        detail
      };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "error de red"
    };
  }
}

/** Texto plano primero: es lo que ve quien filtra HTML, y no es poca gente. */
function inviteText({ to, appUrl, telegramLink, invitedBy }: InviteInput): string {
  return [
    `${invitedBy} te invitó a Sydney.`,
    "",
    "Sydney es una lista de tareas a la que le escribes como a una persona.",
    'Le dices "pagar la luz el viernes" y la anota con la fecha puesta.',
    "",
    "Son dos lados de la misma cuenta, y puedes empezar por cualquiera:",
    "",
    `1) La web, para ver y ordenar tus tareas. Entra con ${to}:`,
    `   ${appUrl}`,
    "",
    "2) Telegram, que es donde Sydney te habla a ti: te manda un resumen en la",
    "   mañana y otro en la noche, y le escribes —o le mandas un audio— desde el",
    "   teléfono, sin abrir nada. Este enlace abre el chat y te deja dentro:",
    `   ${telegramLink}`,
    "",
    "El enlace de Telegram sirve 30 días. Si no tienes la app, te lleva a instalarla."
  ].join("\n");
}

/**
 * HTML de correo: tablas y estilos en línea.
 *
 * No es descuido — los clientes de correo no soportan flexbox ni hojas de
 * estilo externas de forma confiable, y Gmail borra el `<style>` del head.
 *
 * Las dos puertas van **explicadas, no solo enlazadas**. Antes eran dos botones
 * que decían "Abrir en la web" y "Abrir en Telegram": para quien ya conoce el
 * producto son una elección, y para quien lo recibe por primera vez —que es todo
 * el mundo que recibe esto— son dos enlaces sin motivo para tocar ninguno.
 */
function inviteHtml({ to, appUrl, telegramLink, invitedBy }: InviteInput): string {
  const esc = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const door = (
    num: string,
    title: string,
    body: string,
    href: string,
    label: string,
    primary: boolean
  ) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #E2E5F0;border-radius:12px;">
          <tr><td style="padding:16px 18px;">
            <div style="color:#151A3A;font-size:15px;font-weight:700;">
              <span style="color:#8A90B0;">${num}</span> &nbsp;${title}
            </div>
            <div style="color:#5B6188;font-size:14px;line-height:1.6;margin:6px 0 14px;">${body}</div>
            <a href="${esc(href)}" style="display:inline-block;${
              primary
                ? "background:#3D4BC7;color:#FFFFFF;border:1px solid #3D4BC7;"
                : "background:#FFFFFF;color:#3D4BC7;border:1px solid #C8CEF2;"
            }text-decoration:none;font-size:14.5px;font-weight:600;padding:10px 18px;border-radius:8px;">${label}</a>
          </td></tr>
        </table>`;

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#F7F8FC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E5F0;border-radius:18px;overflow:hidden;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
      <tr><td style="background:linear-gradient(150deg,#232B63,#151A3A);padding:28px 28px 24px;">
        <div style="color:#FFFFFF;font-size:17px;font-weight:700;letter-spacing:-.01em;">Sydney</div>
        <div style="color:#B9BEE0;font-size:14px;margin-top:6px;">${esc(invitedBy)} te invitó</div>
      </td></tr>

      <tr><td style="padding:26px 28px 4px;">
        <p style="margin:0 0 12px;color:#151A3A;font-size:16px;line-height:1.5;">
          Es una lista de tareas a la que le <b>escribes como a una persona</b>.
        </p>
        <p style="margin:0 0 22px;color:#5B6188;font-size:14.5px;line-height:1.6;">
          Le dices “pagar la luz el viernes” y la anota con la fecha puesta. Son dos lados de
          <b style="color:#151A3A;">la misma cuenta</b> — puedes empezar por cualquiera.
        </p>
      </td></tr>

      <tr><td style="padding:0 28px;">
        ${door(
          "1",
          "La web",
          `Para ver y ordenar tus tareas. Entra con <b style="color:#151A3A;">${esc(to)}</b>.`,
          appUrl,
          "Abrir la web",
          true
        )}
        ${door(
          "2",
          "Telegram",
          "Es donde Sydney te habla a ti: te manda un resumen en la mañana y otro en la noche, y le escribes —o le mandas un audio— desde el teléfono, sin abrir nada.",
          telegramLink,
          "Abrir el chat",
          false
        )}
      </td></tr>

      <tr><td style="padding:6px 28px 26px;">
        <p style="margin:0;color:#8A90B0;font-size:12.5px;line-height:1.6;">
          El enlace de Telegram sirve 30 días. Si no tienes la app, te lleva a instalarla.
        </p>
        <p style="margin:10px 0 0;color:#A8ADC6;font-size:11.5px;line-height:1.5;word-break:break-all;">
          ${esc(appUrl)}<br>${esc(telegramLink)}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
