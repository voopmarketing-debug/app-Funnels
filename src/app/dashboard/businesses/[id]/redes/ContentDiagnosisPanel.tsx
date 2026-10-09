"use client";

import { useState, useTransition } from "react";
import { generateContentDiagnosis } from "@/lib/socialActions";
import type { ContentDiagnosis, ContentIdea } from "@/lib/contentDiagnosis";
import { ScoreRing } from "../analytics/SalesDiagnosisPanel";
import { shortDateTime } from "./format";

type Current = { diagnosis: ContentDiagnosis; generatedAt: string } | null;

const TABS = [
  { key: "todo", label: "Qué hacer", dot: "bg-accent" },
  { key: "good", label: "Funciona", dot: "bg-[#0ca30c]" },
  { key: "bad", label: "No funciona", dot: "bg-error" },
] as const;

function verdict(score: number) {
  if (score >= 8) return { label: "Tu contenido conecta muy bien", color: "#0ca30c", bg: "rgba(12,163,12,0.12)", text: "var(--status-good)" };
  if (score >= 5) return { label: "Va bien, pero puede atraer más", color: "#fab219", bg: "rgba(250,178,25,0.16)", text: "var(--status-warn)" };
  return { label: "Tu contenido no está conectando", color: "#d03b3b", bg: "rgba(208,59,59,0.12)", text: "var(--status-bad)" };
}

const NETWORK_STYLE: Record<ContentIdea["red"], string> = {
  Instagram: "var(--series-ig)",
  Facebook: "var(--series-fb)",
  Ambas: "var(--ink-muted)",
};

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-ink-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: NETWORK_STYLE[idea.red] }} />
          {idea.red === "Ambas" ? "Facebook e Instagram" : idea.red}
        </span>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">{idea.formato}</span>
      </div>
      <h4 className="text-[15px] font-semibold leading-snug text-ink">{idea.titulo}</h4>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Empieza con</p>
        <p className="text-sm font-medium leading-relaxed text-ink">“{idea.gancho}”</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Qué mostrar</p>
        <p className="text-sm leading-relaxed text-ink-muted">{idea.desarrollo}</p>
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Texto para publicar</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(idea.texto);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink"
          >
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{idea.texto}</p>
      </div>
      <p className="mt-auto text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">Por qué:</span> {idea.porque}
      </p>
    </article>
  );
}

export function ContentDiagnosisPanel({ businessId, initial }: { businessId: string; initial: Current }) {
  const [isPending, start] = useTransition();
  const [current, setCurrent] = useState<Current>(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todo");

  function generate() {
    setNotice(null);
    start(async () => {
      const res = await generateContentDiagnosis(businessId);
      if (res.status === "ok") {
        setCurrent({ diagnosis: res.diagnosis, generatedAt: res.generatedAt });
        setTab("todo");
      } else if (res.status === "insufficient_data") {
        setNotice(
          `Encontramos ${res.posts} ${res.posts === 1 ? "publicación" : "publicaciones"} en los últimos 90 días. Con al menos 4 la IA ya puede ver qué te funciona; mientras tanto, publica y vuelve a intentarlo.`,
        );
      } else {
        setNotice(res.message);
      }
    });
  }

  const d = current?.diagnosis;
  const v = d ? verdict(d.puntuacion) : null;
  const list = d ? (tab === "todo" ? d.recomendaciones.slice(1) : tab === "good" ? d.funciona : d.noFunciona) : [];

  return (
    <section className="fl-ai-frame rounded-[1.35rem] p-[1.5px]">
      <div className="space-y-5 rounded-[1.3rem] bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="fl-ai-badge flex h-10 w-10 flex-none items-center justify-center rounded-xl text-lg text-white">✦</span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight text-ink">Diagnóstico de contenido con IA</h2>
              <p className="text-sm text-ink-muted">La IA revisa tus publicaciones reales, te dice qué funciona y te da ideas listas para publicar.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending && <span className="h-2 w-2 animate-pulse rounded-full bg-accent-ink" />}
            {isPending ? "Analizando…" : current ? "Actualizar" : "Analizar mi contenido"}
          </button>
        </div>

        {isPending && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <span className="fl-ai-badge h-2 w-2 animate-ping rounded-full" />
            Revisando tus publicaciones y preparando ideas. Tarda hasta 40 segundos.
          </p>
        )}
        {notice && <p className="rounded-lg border border-border-strong bg-surface-2 p-3 text-sm text-ink">{notice}</p>}
        {!current && !notice && !isPending && (
          <p className="text-sm text-ink-muted">
            Toca «Analizar mi contenido» y en menos de un minuto sabrás qué tipo de publicaciones le gustan a tu audiencia, cuándo publicar y qué hacer
            esta semana.
          </p>
        )}

        {d && v && current && (
          <>
            <div className="flex gap-4 rounded-2xl bg-surface-2/60 p-4">
              <ScoreRing score={d.puntuacion} color={v.color} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: v.bg, color: v.text }}>
                    {v.label}
                  </span>
                  <span className="text-xs text-ink-muted">{shortDateTime(current.generatedAt)}</span>
                </div>
                <p className="text-[15px] leading-relaxed text-ink">{d.resumen}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {d.recomendaciones[0] && (
                <div className="flex gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">1</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-accent">Empieza por aquí</p>
                    <p className="mt-0.5 text-[15px] font-medium leading-relaxed text-ink">{d.recomendaciones[0]}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 rounded-2xl border border-border bg-surface-2/50 p-4">
                <span className="mt-0.5 text-lg" aria-hidden="true">🕒</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Cuándo publicar</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-ink">{d.cuandoPublicar}</p>
                </div>
              </div>
            </div>

            <div>
              <div role="tablist" aria-label="Detalle del diagnóstico" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
                {TABS.map((t) => {
                  const count = t.key === "todo" ? Math.max(0, d.recomendaciones.length - 1) : t.key === "good" ? d.funciona.length : d.noFunciona.length;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2.5 text-[13px] font-semibold transition sm:text-sm ${
                        tab === t.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
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
                {list.map((item, i) => (
                  <li key={`${tab}-${i}`} className="flex gap-3 py-3 text-sm leading-relaxed text-ink first:pt-1 last:pb-0">
                    {tab === "todo" ? (
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 2}</span>
                    ) : tab === "bad" ? (
                      <span className="mt-2 h-2 w-2 flex-none rounded-full bg-error" />
                    ) : (
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#0ca30c]/15 text-[11px] font-bold text-[var(--status-good)]">✓</span>
                    )}
                    <span>{item}</span>
                  </li>
                ))}
                {list.length === 0 && <li className="py-3 text-sm text-ink-muted">Nada más por aquí.</li>}
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-ink">Ideas para tus próximas publicaciones</h3>
                <p className="text-sm text-ink-muted">Basadas en lo que ya le gusta a tu audiencia. Copia el texto y publícalas tal cual o ajústalas a tu estilo.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {d.ideas.map((idea, i) => (
                  <IdeaCard key={i} idea={idea} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
