/**
 * Cabeceras de seguridad.
 *
 * Hasta el 2026-09-11 este archivo era `{}`: sin CSP, sin antiframing, sin
 * política de referente. La app dibuja texto escrito por el usuario y un QR como
 * data URL, así que esto no es higiene teórica.
 *
 * ⚠️ **`script-src` y `frame-src` tienen que dejar pasar a Google Identity
 * Services o la pantalla de acceso se queda sin botón, en silencio y sin un solo
 * error en consola** — el riesgo más caro que documenta DESIGN.md. Cualquier
 * cambio a esta lista se prueba cargando `/` sin sesión y mirando el iframe.
 *
 * `'unsafe-inline'` en `script-src` es una concesión consciente: el App Router
 * inyecta scripts de arranque en línea, y quitarlo exige nonces por middleware.
 * Una CSP sin `unsafe-inline` que rompe el ingreso es peor que una con él, y el
 * valor real de esta cabecera aquí es `frame-ancestors` y `object-src`.
 * `unsafe-eval` va solo en desarrollo, donde lo necesita el refresco en caliente.
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  // `data:` es el QR de Telegram, que se genera en el cliente y nunca sale a la red.
  "img-src 'self' data: blob: https://*.googleusercontent.com https://accounts.google.com",
  // `blob:` es el audio grabado antes de subirlo a transcribir.
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"])
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // El micrófono se queda: es la nota de voz. Lo demás no se usa.
            value: "camera=(), geolocation=(), microphone=(self), interest-cohort=()"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          }
        ]
      },
      {
        // Una respuesta de la API que se quede en una caché compartida es la
        // forma barata de servirle a alguien los datos de otra persona.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, private" }]
      }
    ];
  }
};

export default nextConfig;
