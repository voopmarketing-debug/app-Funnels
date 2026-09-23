import Link from "next/link";
import { auth } from "@/auth";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { getAccountLineStatus } from "@/lib/lineLimits";
import { PLAN_LABELS } from "@/lib/plans";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { NewBusinessForm } from "./NewBusinessForm";

export default async function NewBusinessPage() {
  const session = await auth();
  const lineStatus = session?.user?.id ? await getAccountLineStatus(session.user.id) : null;

  if (lineStatus?.atLimit) {
    return (
      <div className="mx-auto max-w-md">
        <div className="fl-card-hero space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-2xl">
            🔒
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Llegaste al límite de tu plan</h1>
            <p className="text-sm text-ink-muted">
              Tu plan <span className="font-semibold text-ink">{PLAN_LABELS[lineStatus.planTier]}</span> permite
              hasta {lineStatus.limit} {lineStatus.limit === 1 ? "línea" : "líneas"} de WhatsApp, y ya tienes{" "}
              {lineStatus.count}. Actualiza de plan o escríbenos y te ayudamos a agregar más.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={SUPPORT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              Hablar con soporte
            </a>
            <Link
              href="/dashboard"
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
            >
              Volver a agentes de IA
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Nuevo agente de IA</h1>

      <NewBusinessForm industryOptions={INDUSTRY_OPTIONS} />
    </div>
  );
}
