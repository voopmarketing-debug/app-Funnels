"use client";

import { useState, useTransition } from "react";
import { generateSalesDiagnosis, type SalesDiagnosisResult } from "@/lib/actions";
import type { SalesDiagnosis } from "@/lib/diagnosis";

type InitialDiagnosis = { diagnosis: SalesDiagnosis; generatedAt: string } | null;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "#0ca30c" : score >= 5 ? "#fab219" : "#d03b3b";
  return (
    <div className="flex flex-none flex-col items-center justify-center rounded-lg border border-border px-4 py-2">
      <span className="text-2xl font-bold" style={{ color }}>
        {score}
      </span>
      <span className="fl-mono text-[10px] tracking-wide text-ink-faint">/ 10</span>
    </div>
  );
}

export function SalesDiagnosisPanel({
  businessId,
  initialDiagnosis,
}: {
  businessId: string;
  initialDiagnosis: InitialDiagnosis;
}) {
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState<InitialDiagnosis>(initialDiagnosis);
  const [notice, setNotice] = useState<string | null>(null);

  function handleGenerate() {
    setNotice(null);
    startTransition(async () => {
      const result: SalesDiagnosisResult = await generateSalesDiagnosis(businessId);
      if (result.status === "ok") {
        setCurrent({ diagnosis: result.diagnosis, generatedAt: result.generatedAt });
      } else if (result.status === "insufficient_data") {
        setNotice("Todavía no hay suficientes conversaciones reales para un diagnóstico útil. Necesitas al menos unas cuantas conversaciones con varios mensajes cada una.");
      } else {
        setNotice(result.message);
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Diagnóstico de ventas (IA)</h2>
          <p className="mt-1 text-xs text-ink-faint">
            La IA lee tus conversaciones reales de WhatsApp y te dice qué mejorar en el trato con el cliente y el
            cierre para vender más — no es una opinión genérica, está basado en lo que de verdad pasó.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="flex-none rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Analizando..." : current ? "Actualizar diagnóstico" : "Generar diagnóstico"}
        </button>
      </div>

      {notice && (
        <p className="mt-4 rounded-md border border-border-strong bg-surface-2 p-3 text-sm text-ink-muted">{notice}</p>
      )}

      {!current && !notice && !isPending && (
        <p className="mt-4 text-sm text-ink-muted">
          Todavía no has generado un diagnóstico. Dale clic al botón para analizar tus conversaciones.
        </p>
      )}

      {current && (
        <div className="mt-4 space-y-5">
          <p className="fl-mono text-[11px] tracking-wide text-ink-faint">
            Generado el {formatDate(current.generatedAt)}
          </p>

          <div className="flex items-start gap-4">
            <ScoreBadge score={current.diagnosis.puntuacion} />
            <p className="text-sm text-ink">{current.diagnosis.resumen}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 fl-mono text-[11px] uppercase tracking-wide text-accent-dim" style={{ color: "#8fd400" }}>
                Fortalezas
              </h3>
              <ul className="space-y-2">
                {current.diagnosis.fortalezas.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-muted">
                    <span className="mt-0.5 flex-none text-accent" style={{ color: "#b5ff2b" }}>
                      +
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 fl-mono text-[11px] uppercase tracking-wide text-error">Debilidades</h3>
              <ul className="space-y-2">
                {current.diagnosis.debilidades.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-muted">
                    <span className="mt-0.5 flex-none text-error">−</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="mb-2 fl-mono text-[11px] uppercase tracking-wide text-ink-muted">
              Recomendaciones para vender más
            </h3>
            <ol className="space-y-2">
              {current.diagnosis.recomendaciones.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-ink">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
