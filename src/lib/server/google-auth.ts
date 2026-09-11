import { OAuth2Client } from "google-auth-library";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

if (!clientId) {
  console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google auth will fail until configured.");
}

const oauthClient = new OAuth2Client(clientId || "missing-google-client-id");

export async function verifyGoogleCredential(credential: string): Promise<{
  email: string;
  name: string;
  googleSub: string;
}> {
  if (!clientId) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: clientId
  });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload?.sub) {
    throw new Error("Invalid Google token payload");
  }

  // Sin esto, toda la app cuelga de un string. `isAdminUser` compara el correo
  // y nada más, así que un token con un correo sin verificar que coincidiera con
  // ADMIN_EMAILS sería administrador. Google no emite eso en este flujo — pero
  // "el proveedor no suele hacerlo" no es un control de acceso.
  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified");
  }

  return {
    email: payload.email,
    name: payload.name || "",
    googleSub: payload.sub
  };
}
