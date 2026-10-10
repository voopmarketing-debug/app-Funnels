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
    <nav aria-label="Secciones de redes sociales" className="fl-seg">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className="fl-seg-item text-sm"
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
