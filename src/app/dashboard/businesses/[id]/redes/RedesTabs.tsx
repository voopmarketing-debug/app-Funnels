import Link from "next/link";
import { ChatIcon } from "../analytics/StatIcons";
import { TrendIcon } from "./icons";

// Métricas | Mensajes: the two halves of Redes sociales, kept apart from the
// WhatsApp CRM on purpose (social DMs are answered by people, not the AI).
export function RedesTabs({ businessId, active }: { businessId: string; active: "metricas" | "mensajes" }) {
  const tabs = [
    { key: "metricas", label: "Métricas", href: `/dashboard/businesses/${businessId}/redes`, icon: <TrendIcon /> },
    { key: "mensajes", label: "Mensajes", href: `/dashboard/businesses/${businessId}/redes/mensajes`, icon: <ChatIcon /> },
  ] as const;
  return (
    <nav aria-label="Secciones de redes sociales" className="inline-flex rounded-xl border border-border bg-surface p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
            active === t.key ? "bg-accent text-accent-ink shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
