"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateBusinessWebsite } from "@/lib/actions";

export function WebsiteManager({
  businessId,
  hasWabaCredentials,
  website,
  publicUrlBase,
}: {
  businessId: string;
  hasWabaCredentials: boolean;
  website: { slug: string; generatedAt: Date } | null;
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

        {website && publicUrl && (
          <div className="space-y-2">
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
            <p className="text-xs text-ink-muted">
              ¿Quieres un dominio propio o un subdominio (como negocio.funnelslabs.app) en vez de este link? Es un
              paso manual de DNS — pídenoslo y lo conectamos igual que hicimos con agente.funnelslabs.app.
            </p>
          </div>
        )}

        {!website && hasWabaCredentials && !isPending && (
          <p className="text-sm text-ink-muted">Todavía no se ha generado un sitio para este negocio.</p>
        )}
      </div>

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
