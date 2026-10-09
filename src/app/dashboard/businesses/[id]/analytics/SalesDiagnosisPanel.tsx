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
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todo");
  const [summaryOpen, setSummaryOpen] = useState(false);

  function handleGenerate() {
    setNotice(null);
    startTransition(async () => {
      const result: SalesDiagnosisResult = await generateSalesDiagnosis(businessId);
      if (result.status === "ok") {
        setCurrent({ diagnosis: result.diagnosis, generatedAt: result.generatedAt });
        setTab("todo");
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
    <section className="fl-ai-frame rounded-[1.35rem] p-[1.5px]">
      <div className="space-y-4 rounded-[1.3rem] bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="fl-ai-badge flex h-10 w-10 flex-none items-center justify-center rounded-xl text-lg text-white">✦</span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight text-ink">Diagnóstico de ventas con IA</h2>
              <p className="text-sm text-ink-muted">La IA leyó tus conversaciones reales y te dice qué mejorar para vender más.</p>
            </div>
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

        {isPending && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <span className="fl-ai-badge h-2 w-2 animate-ping rounded-full" />
            Leyendo tus conversaciones a fondo. Tarda hasta 30 segundos.
          </p>
        )}
        {notice && <p className="rounded-lg border border-border-strong bg-surface-2 p-3 text-sm text-ink">{notice}</p>}

        {!current && !notice && !isPending && (
          <p className="text-sm text-ink-muted">
            Todavía no tienes un diagnóstico. Genéralo y la IA te dirá qué está funcionando, qué te está costando ventas y qué hacer primero.
          </p>
        )}

        {d && verdict && current && (
          <>
            {/* Score + verdict + summary, compact: the summary folds after 3 lines. */}
            <div className="flex gap-4 rounded-2xl bg-surface-2/60 p-4">
              <ScoreRing score={d.puntuacion} color={verdict.color} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: verdict.bg, color: verdict.text }}>
                    {verdict.label}
                  </span>
                  <span className="text-xs text-ink-muted">{formatDate(current.generatedAt)}</span>
                </div>
                <p className={`text-[15px] leading-relaxed text-ink ${summaryOpen ? "" : "line-clamp-3"}`}>{d.resumen}</p>
                <button type="button" onClick={() => setSummaryOpen((v) => !v)} className="py-1 text-sm font-semibold text-accent">
                  {summaryOpen ? "Ver menos" : "Leer resumen completo"}
                </button>
              </div>
            </div>

            {d.recomendaciones[0] && (
              <div className="flex gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">1</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-accent">Empieza por aquí</p>
                  <p className="mt-0.5 text-[15px] font-medium leading-relaxed text-ink">{d.recomendaciones[0]}</p>
                </div>
              </div>
            )}

            {/* One list at a time instead of three stacked: much less scroll. */}
            <div>
              <div role="tablist" aria-label="Detalle del diagnóstico" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
                {TABS.map((t) => {
                  const count = t.key === "fix" ? d.debilidades.length : t.key === "todo" ? Math.max(0, d.recomendaciones.length - 1) : d.fortalezas.length;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.key)}
                      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2.5 text-[13px] font-semibold transition sm:text-sm ${
                        active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      <span className={`hidden h-2 w-2 flex-none rounded-full sm:block ${t.dot}`} />
                      <span className="truncate">{t.label}</span>
                      <span className="flex-none text-xs font-normal text-ink-muted">{count}</span>
                    </button>
                  );
                })}
              </div>
              <ul role="tabpanel" className="mt-3 divide-y divide-border">
                {/* "Qué hacer" continues after the first step, already shown in "Empieza por aquí". */}
                {(tab === "fix" ? d.debilidades : tab === "todo" ? d.recomendaciones.slice(1) : d.fortalezas).map((item, i) => (
                  <li key={`${tab}-${i}`} className="flex gap-3 py-3 text-sm leading-relaxed text-ink first:pt-1 last:pb-0">
                    {tab === "todo" ? (
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 2}</span>
                    ) : tab === "fix" ? (
                      <span className="mt-2 h-2 w-2 flex-none rounded-full bg-error" />
                    ) : (
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#0ca30c]/15 text-[11px] font-bold text-[var(--status-good)]">✓</span>
                    )}
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const TABS = [
  { key: "todo", label: "Qué hacer", dot: "bg-accent" },
  { key: "fix", label: "Te cuesta", dot: "bg-error" },
  { key: "good", label: "Lo bueno", dot: "bg-[#0ca30c]" },
] as const;

function scoreVerdict(score: number): { label: string; color: string; bg: string; text: string } {
  if (score >= 8) return { label: "Tu agente vende muy bien", color: "#0ca30c", bg: "rgba(12,163,12,0.12)", text: "var(--status-good)" };
  if (score >= 5) return { label: "Va bien, pero puede vender más", color: "#fab219", bg: "rgba(250,178,25,0.16)", text: "var(--status-warn)" };
  return { label: "Está dejando ventas sobre la mesa", color: "#d03b3b", bg: "rgba(208,59,59,0.12)", text: "var(--status-bad)" };
}

export function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 flex-none md:h-20 md:w-20" role="img" aria-label={`Puntuación ${score} de 10`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" style={{ stroke: "var(--surface-2)" }} />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={color} strokeDasharray={`${(score / 10) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-ink md:text-2xl">{score}</span>
        <span className="text-[11px] text-ink-muted">de 10</span>
      </span>
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
