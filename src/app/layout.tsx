import type { Metadata } from "next";
import { Figtree, Sora } from "next/font/google";
import "./globals.css";

/**
 * Self-hosted by next/font at build time: no request to Google at runtime, no
 * layout shift while a webfont loads, and nothing to configure in the CSP.
 * The variables are consumed by `fontFamily` in tailwind.config.ts.
 */
const display = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

const sans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Sydney",
  description: "Tus tareas, en la web y en Telegram."
};

/**
 * El tema, antes del primer pintado.
 *
 * `useTheme` corre en un efecto, o sea después de hidratar. Mientras el tema por
 * omisión era claro eso no se notaba; con oscuro por omisión, cada carga pintaba
 * una pantalla blanca y saltaba a oscura un instante después — el destello que
 * más delata que una app se armó por partes.
 *
 * Va en línea y bloqueando a propósito: cualquier cosa asíncrona llega tarde por
 * definición. Es diminuto, y la CSP lo permite porque `script-src` ya incluye
 * `'unsafe-inline'` para los scripts de arranque del App Router.
 *
 * Duplica la regla de `useTheme` —elección guardada, si no oscuro— y esa
 * duplicación es real: si una cambia, la otra también. Es el precio de decidir
 * antes de que exista React, y el `catch` vacío importa, porque un navegador que
 * niega el almacenamiento no debe quedarse sin pintar.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("sydney-theme");document.documentElement.dataset.theme=(t==="light"||t==="dark")?t:"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
