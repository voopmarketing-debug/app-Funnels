import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Applies the client's saved theme choice (see ThemeToggle.tsx) before the
// page paints, so light mode doesn't load dark on every refresh. Rendered as
// a plain inline <script> in <head> so the browser runs it synchronously
// while parsing — next/script's beforeInteractive only queues it for the
// Next.js runtime, which runs after first paint (and noticeably later on a
// slow phone), so the page showed dark until the JS bundle loaded.
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
  // Installable on the phone's home screen (needed for push notifications
  // on iPhone) — see app/manifest.ts.
  appleWebApp: { capable: true, title: "Funnels Labs", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${montserrat.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // The inline theme script (in <head>) sets data-theme on this
      // element before React hydrates, based on localStorage — which the
      // server can't know at render time. That's an intentional mismatch on
      // this one attribute, not a bug: suppress the hydration warning for it.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
