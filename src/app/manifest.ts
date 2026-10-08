import type { MetadataRoute } from "next";

// Lets the dashboard be installed as an app (home screen / dock). On iPhone
// that's also what enables push notifications for new chats.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Funnels Labs — Agentes de IA",
    short_name: "Funnels Labs",
    description: "Tu agente de IA para WhatsApp, tu CRM y tus KPIs.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0d08",
    theme_color: "#0b0d08",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
