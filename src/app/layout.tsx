import type { Metadata } from "next";
import { Figtree, Sora } from "next/font/google";
import { getMessages } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";
import { readLanguageCookie } from "@/lib/i18n/server";
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

/**
 * El título y la descripción también son texto de la interfaz.
 *
 * Tenía que dejar de ser una constante: una constante no puede leer una cookie.
 * Es la mitad de lo que el idioma le debe al servidor — la otra es `<html lang>`,
 * que los lectores de pantalla y el traductor del navegador leen antes que nada.
 */
export function generateMetadata(): Metadata {
  const t = getMessages(readLanguageCookie());
  return { title: t.meta.title, description: t.meta.description };
}

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

/**
 * El idioma, antes del primer pintado — y por una vía distinta a la del tema.
 *
 * El truco de `THEME_BOOTSTRAP` no sirve acá. Funciona porque el tema es *un
 * atributo* de <html> que un script en línea alcanza a poner; el idioma es cada
 * texto de la página, y ningún script en línea puede re-renderizar React. La
 * cookie es el único mecanismo que deja al servidor pintar el idioma correcto a
 * la primera en vez de corregirlo un instante después.
 *
 * El precio: `cookies()` vuelve dinámica toda la app. Se asume — cada página ya
 * es "use client" y trae sus propios datos, así que no había nada estático que
 * perder.
 *
 * El proveedor envuelve *todo*, incluida la pantalla de acceso, que es anterior
 * a cualquier cuenta y es lo primero que ve alguien a quien le estás mostrando
 * esto.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const language = readLanguageCookie();
  return (
    // `suppressHydrationWarning` solo acá, en <html>, y solo por `data-theme`:
    // THEME_BOOTSTRAP lo escribe antes de que React hidrate, así que React ve un
    // atributo que el servidor no mandó y avisa. El aviso es correcto y la
    // diferencia es a propósito. Callarlo importa porque el idioma trae estado
    // de cliente de verdad: un aviso de hidratación falso enseña a ignorar los
    // reales. No se extiende a ningún hijo.
    <html
      lang={language}
      className={`${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="font-sans">
        <I18nProvider initialLanguage={language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
