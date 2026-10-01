"use client";

import { useState, useTransition } from "react";
import { generateSalesDiagnosis, type SalesDiagnosisResult } from "@/lib/actions";
import type { SalesDiagnosis } from "@/lib/diagnosis";

type InitialDiagnosis = { diagnosis: SalesDiagnosis; generatedAt: string } | null;

// Runs server-side (Vercel = UTC), so timeZone must be explicit or the
// timestamp shows ~5h ahead of the real Bogotá time.
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

// Builds and downloads the report as a PDF client-side (jsPDF) — the report
// is short, plain-text prose, so this needed no server round-trip or heavy
// layout engine, just paginated wrapped text.
async function downloadDiagnosisPdf(businessName: string, diagnosis: SalesDiagnosis, generatedAt: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 56;

  function write(text: string, fontSize: number, bold = false, lineGap = 15, gapAfter = 10) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    for (const line of doc.splitTextToSize(text, maxWidth) as string[]) {
      if (y > pageHeight - 56) {
        doc.addPage();
        y = 56;
      }
      doc.text(line, marginX, y);
      y += lineGap;
    }
    y += gapAfter;
  }

  write(`Diagnóstico de ventas — ${businessName}`, 17, true, 20, 4);
  write(`Generado el ${formatDate(generatedAt)}`, 10, false, 12, 14);
  write(`Puntuación: ${diagnosis.puntuacion} / 10`, 13, true, 15, 12);
  write(diagnosis.resumen, 11);

  write("Fortalezas", 13, true, 15, 6);
  diagnosis.fortalezas.forEach((item) => write(`+  ${item}`, 11));

  write("Debilidades", 13, true, 15, 6);
  diagnosis.debilidades.forEach((item) => write(`–  ${item}`, 11));

  write("Recomendaciones", 13, true, 15, 6);
  diagnosis.recomendaciones.forEach((item, i) => write(`${i + 1}.  ${item}`, 11));

  const safeName = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  doc.save(`diagnostico-ventas-${safeName || "negocio"}.pdf`);
}

export function SalesDiagnosisPanel({
  businessId,
  businessName,
  initialDiagnosis,
}: {
  businessId: string;
  businessName: string;
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

  const d = current?.diagnosis;
  const verdict = d ? scoreVerdict(d.puntuacion) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Diagnóstico de ventas</h2>
          <p className="max-w-2xl text-sm text-ink-muted">
            La IA lee tus conversaciones reales de WhatsApp y te dice qué mejorar para vender más.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {current && (
            <button
              type="button"
              onClick={() => downloadDiagnosisPdf(businessName, current.diagnosis, current.generatedAt)}
              className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent"
            >
              <DownloadIcon /> PDF
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending && <span className="h-2 w-2 animate-pulse rounded-full bg-accent-ink" />}
            {isPending ? "Analizando…" : current ? "Actualizar" : "Generar diagnóstico"}
          </button>
        </div>
      </div>

      {isPending && <p className="text-sm text-ink-muted">Puede tardar hasta 30 segundos: está leyendo tus conversaciones a fondo.</p>}
      {notice && <p className="rounded-lg border border-border-strong bg-surface-2 p-3 text-sm text-ink">{notice}</p>}

      {!current && !notice && !isPending && (
        <div className="fl-card p-5 text-sm text-ink-muted">
          Todavía no tienes un diagnóstico. Genéralo y la IA te dirá qué está funcionando, qué te está costando ventas y qué hacer primero.
        </div>
      )}

      {d && verdict && current && (
        <>
          {/* Score + summary: the one thing to read */}
          <div className="fl-card flex flex-col gap-5 p-5 md:flex-row md:items-center">
            <ScoreRing score={d.puntuacion} color={verdict.color} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: verdict.bg, color: verdict.text }}>
                  {verdict.label}
                </span>
                <span className="text-xs text-ink-muted">Generado el {formatDate(current.generatedAt)}</span>
              </div>
              <p className="text-[15px] leading-relaxed text-ink">{d.resumen}</p>
            </div>
          </div>

          {/* The first thing to do */}
          {d.recomendaciones[0] && (
            <div className="rounded-2xl border-2 border-accent/50 bg-accent/10 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-accent">Empieza por aquí</p>
              <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-ink">{d.recomendaciones[0]}</p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <DiagnosisList
              title="Qué te está costando ventas"
              subtitle="Lo que pasó en tus conversaciones reales"
              tone="bad"
              items={d.debilidades}
            />
            <DiagnosisList
              title="Qué hacer para vender más"
              subtitle="En orden de prioridad"
              tone="todo"
              items={d.recomendaciones}
              numbered
            />
          </div>

          <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)} className="fl-card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-sm font-semibold text-ink">Lo que ya haces bien ({d.fortalezas.length})</span>
                <span className="block text-xs text-ink-muted">Mantén esto: está funcionando</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-none text-ink-muted transition-transform group-open:rotate-180">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="mt-4 divide-y divide-border">
              {d.fortalezas.map((item, i) => (
                <li key={i} className="flex gap-3 py-3 text-sm leading-relaxed text-ink first:pt-0 last:pb-0">
                  <span className="mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#0ca30c]/15 text-[11px] font-bold text-[var(--status-good)]">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function scoreVerdict(score: number): { label: string; color: string; bg: string; text: string } {
  if (score >= 8) return { label: "Tu agente vende muy bien", color: "#0ca30c", bg: "rgba(12,163,12,0.12)", text: "var(--status-good)" };
  if (score >= 5) return { label: "Va bien, pero puede vender más", color: "#fab219", bg: "rgba(250,178,25,0.16)", text: "var(--status-warn)" };
  return { label: "Está dejando ventas sobre la mesa", color: "#d03b3b", bg: "rgba(208,59,59,0.12)", text: "var(--status-bad)" };
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24 flex-none" role="img" aria-label={`Puntuación ${score} de 10`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" style={{ stroke: "var(--surface-2)" }} />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={color} strokeDasharray={`${(score / 10) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-ink">{score}</span>
        <span className="text-[11px] text-ink-muted">de 10</span>
      </span>
    </div>
  );
}

function DiagnosisList({
  title,
  subtitle,
  items,
  tone,
  numbered = false,
}: {
  title: string;
  subtitle: string;
  items: string[];
  tone: "bad" | "todo";
  numbered?: boolean;
}) {
  return (
    <div className="fl-card p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="text-xs text-ink-muted">{subtitle}</p>
      <ul className="mt-4 divide-y divide-border">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 py-3 text-sm leading-relaxed text-ink first:pt-0 last:pb-0">
            {numbered ? (
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 1}</span>
            ) : (
              <span className={`mt-2 h-2 w-2 flex-none rounded-full ${tone === "bad" ? "bg-error" : "bg-accent"}`} />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5v12M12 15.5 8 11.5M12 15.5l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 17v2.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
