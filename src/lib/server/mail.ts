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
  | { sent: false; reason: "not_configured" | "failed"; detail?: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function mailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendInviteEmail(input: {
  to: string;
  appUrl: string;
  invitedBy: string;
}): Promise<MailResult> {
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
      const detail = (await response.text()).slice(0, 200);
      return { sent: false, reason: "failed", detail: `HTTP ${response.status} ${detail}` };
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
function inviteText({ appUrl, invitedBy }: { appUrl: string; invitedBy: string }): string {
  return [
    `${invitedBy} te invitó a Sydney.`,
    "",
    "Sydney es una lista de tareas a la que le puedes escribir como a una persona.",
    "Le dices “pagar la luz el viernes” y la anota con fecha. Te escribe dos veces",
    "al día: en la mañana lo que viene, en la noche lo que quedó.",
    "",
    `Entra con este mismo correo: ${appUrl}`,
    "",
    "Al entrar te va a preguntar cuatro cosas y queda lista."
  ].join("\n");
}

/**
 * HTML de correo: tablas y estilos en línea.
 *
 * No es descuido — los clientes de correo no soportan flexbox ni hojas de
 * estilo externas de forma confiable, y Gmail borra el `<style>` del head.
 */
function inviteHtml({ appUrl, invitedBy }: { appUrl: string; invitedBy: string }): string {
  const esc = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#F7F8FC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FC;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E2E5F0;border-radius:18px;overflow:hidden;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
      <tr><td style="background:linear-gradient(150deg,#232B63,#151A3A);padding:28px 28px 24px;">
        <div style="color:#FFFFFF;font-size:17px;font-weight:700;letter-spacing:-.01em;">Sydney</div>
        <div style="color:#B9BEE0;font-size:14px;margin-top:6px;">${esc(invitedBy)} te invitó</div>
      </td></tr>
      <tr><td style="padding:26px 28px 8px;">
        <p style="margin:0 0 14px;color:#151A3A;font-size:16px;line-height:1.5;">
          Es una lista de tareas a la que le puedes <b>escribir como a una persona</b>.
        </p>
        <p style="margin:0 0 14px;color:#5B6188;font-size:14.5px;line-height:1.6;">
          Le dices “pagar la luz el viernes” y la anota con fecha. Te escribe dos veces al día:
          en la mañana lo que viene, en la noche lo que quedó pendiente.
        </p>
        <p style="margin:0 0 22px;color:#5B6188;font-size:14.5px;line-height:1.6;">
          Entra con <b style="color:#151A3A;">este mismo correo</b> y queda lista en cuatro preguntas.
        </p>
      </td></tr>
      <tr><td style="padding:0 28px 28px;">
        <a href="${esc(appUrl)}" style="display:inline-block;background:#3D4BC7;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px;">Entrar a Sydney</a>
        <p style="margin:16px 0 0;color:#8A90B0;font-size:12.5px;line-height:1.5;word-break:break-all;">
          O copia esta dirección: ${esc(appUrl)}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
