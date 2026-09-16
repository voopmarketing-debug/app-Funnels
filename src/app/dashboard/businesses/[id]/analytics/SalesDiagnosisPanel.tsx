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

// Meter: fill carries severity, track is a lighter step of the same hue so
// the state reads across the whole bar even before you look at the number.
function severityColors(score: number): { fill: string; track: string } {
  if (score >= 8) return { fill: "#0ca30c", track: "rgba(12,163,12,0.16)" };
  if (score >= 5) return { fill: "#fab219", track: "rgba(250,178,25,0.16)" };
  return { fill: "#d03b3b", track: "rgba(208,59,59,0.16)" };
}

// The model consistently quotes the exact customer/agent messages it's
// using as evidence (e.g. 'Agendemos una llamada'). Bolding those quoted
// spans in a brighter color turns a wall of same-toned text into something
// scannable — the quotes ARE the concrete, important points; everything
// else is connective narration.
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/('[^']+'|"[^"]+")/g);
  return (
    <>
      {parts.map((part, i) =>
        /^['"]/.test(part) ? (
          <strong key={i} className="font-semibold text-ink">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const { fill, track } = severityColors(score);
  return (
    <div className="flex flex-none flex-col items-center gap-1.5">
      <div className="h-2 w-24 overflow-hidden rounded-full" style={{ backgroundColor: track }}>
        <div className="h-full rounded-full" style={{ width: `${(score / 10) * 100}%`, backgroundColor: fill }} />
      </div>
      <span className="fl-mono text-[11px] font-semibold" style={{ color: fill }}>
        {score} / 10
      </span>
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
  // Collapsed by default so a returning visit doesn't add a wall of text to
  // an already-long page — but pops open right after a fresh generation, so
  // the thing you just asked for is the thing you see.
  const [expanded, setExpanded] = useState(false);

  function handleGenerate() {
    setNotice(null);
    startTransition(async () => {
      const result: SalesDiagnosisResult = await generateSalesDiagnosis(businessId);
      if (result.status === "ok") {
        setCurrent({ diagnosis: result.diagnosis, generatedAt: result.generatedAt });
        setExpanded(true);
      } else if (result.status === "insufficient_data") {
        setNotice(
          "Todavía no hay suficientes conversaciones reales para un diagnóstico útil. Necesitas al menos unas cuantas conversaciones con varios mensajes cada una.",
        );
      } else {
        setNotice(result.message);
      }
    });
  }

  return (
    <section className="fl-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Diagnóstico de ventas (IA)</h2>
          <p className="mt-1 text-xs text-ink-faint">
            La IA lee tus conversaciones reales de WhatsApp y te dice qué mejorar en el trato con el cliente y el
            cierre para vender más — no es una opinión genérica, está basado en lo que de verdad pasó.
          </p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending && <span className="h-2 w-2 animate-pulse rounded-full bg-accent-ink" />}
            {isPending ? "Analizando..." : current ? "Actualizar diagnóstico" : "Generar diagnóstico"}
          </button>
          {isPending && <p className="text-[11px] text-ink-faint">Puede tardar hasta 30 segundos — está leyendo tus conversaciones a fondo.</p>}
        </div>
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
        <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)} className="group mt-4">
          <summary
            className="flex cursor-pointer list-none items-center gap-4 rounded-lg border border-border-strong bg-surface-2 px-4 py-3 transition hover:border-accent hover:bg-[#232323] [&::-webkit-details-marker]:hidden"
          >
            <ScoreMeter score={current.diagnosis.puntuacion} />
            <div className="min-w-0 flex-1">
              <p className="fl-mono text-[11px] tracking-wide text-ink-faint">
                Generado el {formatDate(current.generatedAt)}
              </p>
              <p className="truncate text-sm text-ink-muted">{current.diagnosis.resumen}</p>
            </div>
            <span className="flex flex-none items-center gap-1.5 text-sm font-semibold text-accent">
              <span className="hidden group-open:inline">Ocultar</span>
              <span className="group-open:hidden">Ver diagnóstico completo</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className="flex-none transition-transform duration-200 group-open:rotate-180"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>

          <div className="mt-5 space-y-5 border-t border-border pt-5">
            <p className="text-sm text-ink-muted">
              <HighlightedText text={current.diagnosis.resumen} />
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 fl-mono text-[11px] uppercase tracking-wide" style={{ color: "#8fd400" }}>
                  Fortalezas
                </h3>
                <ul className="space-y-2">
                  {current.diagnosis.fortalezas.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-muted">
                      <span className="mt-0.5 flex-none" style={{ color: "#b5ff2b" }}>
                        +
                      </span>
                      <span>
                        <HighlightedText text={item} />
                      </span>
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
                      <span>
                        <HighlightedText text={item} />
                      </span>
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
                  <li key={i} className="flex gap-2.5 text-sm text-ink-muted">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
                      {i + 1}
                    </span>
                    <span>
                      <HighlightedText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
