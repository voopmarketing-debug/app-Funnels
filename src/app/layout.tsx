import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Applies the client's saved theme choice (see ThemeToggle.tsx) before the
// page paints, so light mode doesn't load dark on every refresh. Rendered as
// a plain inline <script> in <head> so the browser runs it synchronously
// while parsing — next/script's beforeInteractive only queues it for the
// Next.js runtime, which runs after first paint (and noticeably later on a
// slow phone), so the page showed dark until the JS bundle loaded.
// The first paint is never white: the dark (or the light, if chosen) ground is set before the
// stylesheet arrives.
const FIRST_PAINT_CSS = "html{background:#0a0a0a}html[data-theme=light]{background:#f6f6f2}";

const THEME_INIT_SCRIPT = `
  try {
    if (window.localStorage.getItem("fl-theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {}
`;

// The platform's typeface: Inter (the closest open face to the one used by the reference dashboards).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// The screen iPhone shows while the installed app opens (it was plain white until the panel arrived):
// dark with the logo, one image per phone size (see public/splash).
const SPLASH_SIZES: [number, number, number][] = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
  [320, 568, 2],
];

export const metadata: Metadata = {
  title: "Funnels Labs — Agentes de IA para WhatsApp",
  description: "Plataforma multi-tenant de agentes de IA para WhatsApp por negocio, por Funnels Labs.",
  // Installable on the phone's home screen (needed for push notifications
  // on iPhone) — see app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: "Funnels Labs",
    statusBarStyle: "black-translucent",
    startupImage: SPLASH_SIZES.map(([w, h, r]) => ({
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // The inline theme script (in <head>) sets data-theme on this
      // element before React hydrates, based on localStorage — which the
      // server can't know at render time. That's an intentional mismatch on
      // this one attribute, not a bug: suppress the hydration warning for it.
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: FIRST_PAINT_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
