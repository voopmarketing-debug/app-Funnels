import type { Metadata } from "next";
import Script from "next/script";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Applies the client's saved theme choice (see ThemeToggle.tsx) before the
// page paints, so switching to light mode doesn't flash dark on every load.
// `beforeInteractive` makes Next.js inline this in <head>, ahead of hydration.
const THEME_INIT_SCRIPT = `
  try {
    if (window.localStorage.getItem("fl-theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {}
`;

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Funnels Labs — Agentes de IA para WhatsApp",
  description: "Plataforma multi-tenant de agentes de IA para WhatsApp por negocio, por Funnels Labs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // The beforeInteractive theme script (below) sets data-theme on this
      // element before React hydrates, based on localStorage — which the
      // server can't know at render time. That's an intentional mismatch on
      // this one attribute, not a bug: suppress the hydration warning for it.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="fl-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
