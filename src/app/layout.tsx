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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
