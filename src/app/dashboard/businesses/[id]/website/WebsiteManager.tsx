"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateBusinessWebsite, updateWebsiteCustomDomain } from "@/lib/actions";

export function WebsiteManager({
  businessId,
  hasWabaCredentials,
  website,
  publicUrlBase,
}: {
  businessId: string;
  hasWabaCredentials: boolean;
  website: { slug: string; generatedAt: Date; customDomain: string | null } | null;
  publicUrlBase: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        await generateBusinessWebsite(businessId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo generar el sitio");
      }
    });
  }

  const publicUrl = website ? `${publicUrlBase}/${website.slug}` : null;

  return (
    <div className="space-y-4">
      {!hasWabaCredentials && (
        <div className="rounded-md border-2 border-[#fab219]/50 bg-surface p-4 text-sm text-ink">
          Conecta primero las credenciales de WhatsApp de este negocio (página del negocio) — el sitio usa ese
          número real para el botón de contacto.
        </div>
      )}

      <div className="fl-card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={isPending || !hasWabaCredentials}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? "Generando... (puede tardar un minuto)" : website ? "Regenerar sitio" : "Generar sitio web"}
          </button>
          {website && (
            <span className="text-xs text-ink-faint">
              Última versión: {website.generatedAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        {!website && hasWabaCredentials && !isPending && (
          <p className="text-sm text-ink-muted">Todavía no se ha generado un sitio para este negocio.</p>
        )}
      </div>

      {website && publicUrl && (
        <div className="fl-card space-y-2 p-5">
          <h2 className="text-sm font-semibold text-ink">Link de tu sitio en Funnels Labs</h2>
          <p className="text-xs text-ink-muted">Ya está activo — cualquiera puede entrar a este link ahora mismo.</p>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <code className="fl-mono flex-1 text-sm text-accent">{publicUrl}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-xs font-medium text-ink-muted hover:text-ink"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-accent hover:underline"
            >
              Ver sitio ↗
            </a>
          </div>
        </div>
      )}

      {website && <CustomDomainForm businessId={businessId} customDomain={website.customDomain} />}

      {website && publicUrl && (
        <div className="fl-card overflow-hidden p-0">
          <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Vista previa
          </div>
          <iframe src={publicUrl} className="h-[600px] w-full" title="Vista previa del sitio" />
        </div>
      )}
    </div>
  );
}

type DomainState = { saved: boolean };

function CustomDomainForm({ businessId, customDomain }: { businessId: string; customDomain: string | null }) {
  const [state, formAction, isPending] = useActionState<DomainState, FormData>(async (_prev, formData) => {
    await updateWebsiteCustomDomain(businessId, formData);
    return { saved: true };
  }, { saved: false });

  return (
    <div className="fl-card space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Dominio propio (opcional)</h2>
        <p className="mt-1 text-xs text-ink-muted">
          ¿Quieres que el sitio se vea en tu propio dominio (como minegocio.com) en vez del link de Funnels Labs? O
          si prefieres un subdominio dedicado (como minegocio.funnelslabs.app), pídelo igual aquí. Escríbelo abajo —
          es un paso de DNS que conectamos nosotros manualmente y te avisamos por WhatsApp cuando quede activo,
          igual que hicimos con agente.funnelslabs.app.
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          name="customDomain"
          defaultValue={customDomain ?? ""}
          placeholder="minegocio.com"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Solicitar"}
        </button>
        {state.saved && !isPending && <span className="fl-mono text-xs text-accent">✓ Guardado</span>}
      </form>

      {customDomain && (
        <p className="text-xs text-ink-muted">
          Dominio solicitado: <span className="fl-mono text-ink">{customDomain}</span> — en revisión, te avisamos
          cuando quede conectado.
        </p>
      )}
    </div>
  );
}
