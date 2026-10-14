"use client";

import { useState, useTransition } from "react";
import { generateContentDiagnosis } from "@/lib/socialActions";
import type { AdIdea, AdsDiagnosis, ContentDiagnosis, ContentIdea } from "@/lib/contentDiagnosis";
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
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
  );
}

function adsVerdict(score: number) {
  if (score >= 8) return { label: "Tus anuncios rinden muy bien", color: "#0ca30c", bg: "rgba(12,163,12,0.12)", text: "var(--status-good)" };
  if (score >= 5) return { label: "Rinden, pero puedes pagar menos por cliente", color: "#fab219", bg: "rgba(250,178,25,0.16)", text: "var(--status-warn)" };
  return { label: "Estás gastando más de lo que te traen", color: "#d03b3b", bg: "rgba(208,59,59,0.12)", text: "var(--status-bad)" };
}

function AdIdeaCard({ idea }: { idea: AdIdea }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface-2/50 p-4">
      <span className="w-fit rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">{idea.formato}</span>
      <h4 className="text-[15px] font-semibold leading-snug text-ink">{idea.titulo}</h4>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Empieza con</p>
        <p className="text-sm font-medium leading-relaxed text-ink">“{idea.gancho}”</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Muéstraselo a</p>
        <p className="text-sm leading-relaxed text-ink-muted">{idea.publico}</p>
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Texto del anuncio</p>
          <CopyButton text={idea.texto} />
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{idea.texto}</p>
      </div>
      <p className="mt-auto text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">Por qué:</span> {idea.porque}
      </p>
    </article>
  );
}

function AdsDiagnosisView({ a, generatedAt }: { a: AdsDiagnosis; generatedAt: string }) {
  const v = adsVerdict(a.puntuacion);
  const [first, ...rest] = a.mejoras;
  return (
    <>
      <div className="flex gap-4 rounded-2xl bg-surface-2/60 p-4">
        <ScoreRing score={a.puntuacion} color={v.color} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: v.bg, color: v.text }}>
              {v.label}
            </span>
            <span className="text-xs text-ink-muted">{shortDateTime(generatedAt)}</span>
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{a.resumen}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {first && (
          <div className="flex gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">1</span>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-accent">Empieza por aquí</p>
              <p className="break-words text-xs font-semibold text-ink-muted [overflow-wrap:anywhere]">{first.campana}</p>
              <p className="text-[15px] font-medium leading-relaxed text-ink">{first.accion}</p>
              <p className="text-sm leading-relaxed text-ink-muted">{first.porque}</p>
            </div>
          </div>
        )}
        <div className="flex gap-3 rounded-2xl border border-border bg-surface-2/50 p-4">
          <span className="mt-0.5 text-lg" aria-hidden="true">💰</span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Dónde poner tu dinero</p>
            <p className="mt-0.5 text-[15px] leading-relaxed text-ink">{a.presupuesto}</p>
          </div>
        </div>
      </div>

      {rest.length > 0 && (
        <ol className="divide-y divide-border">
          {rest.map((m, i) => (
            <li key={i} className="flex gap-3 py-3 text-sm leading-relaxed first:pt-1">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">{i + 2}</span>
              <div className="min-w-0">
                <p className="break-words text-xs font-semibold text-ink-muted [overflow-wrap:anywhere]">{m.campana}</p>
                <p className="font-medium text-ink">{m.accion}</p>
                <p className="text-ink-muted">{m.porque}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Anuncios nuevos para probar</h3>
          <p className="text-sm text-ink-muted">Basados en lo que ya te funcionó. Copia el texto y créalos en el Administrador de anuncios de Meta.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {a.ideas.map((idea, i) => (
            <AdIdeaCard key={i} idea={idea} />
          ))}
        </div>
      </div>
    </>
  );
}

function IdeaCard({ idea }: { idea: ContentIdea }) {
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
          <CopyButton text={idea.texto} />
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
  const [view, setView] = useState<"contenido" | "anuncios">("contenido");

  function generate() {
    setNotice(null);
    start(async () => {
      const res = await generateContentDiagnosis(businessId);
      if (res.status === "ok") {
        setCurrent({ diagnosis: res.diagnosis, generatedAt: res.generatedAt });
        setTab("todo");
        setView("contenido");
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="fl-ai-badge flex h-10 w-10 flex-none items-center justify-center rounded-xl text-lg text-white">✦</span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight text-ink">Diagnóstico con IA</h2>
              <p className="max-w-xl text-sm text-ink-muted">Revisa tus publicaciones y tus anuncios reales y te dice qué hacer.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={isPending}
            className="flex flex-none items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending && <span className="h-2 w-2 animate-pulse rounded-full bg-accent-ink" />}
            {isPending ? "Analizando…" : current ? "Actualizar" : "Analizar con IA"}
          </button>
        </div>

        {isPending && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <span className="fl-ai-badge h-2 w-2 animate-ping rounded-full" />
            Revisando tus publicaciones y tus anuncios y preparando ideas. Tarda hasta un minuto.
          </p>
        )}
        {notice && <p className="rounded-lg border border-border-strong bg-surface-2 p-3 text-sm text-ink">{notice}</p>}
        {!current && !notice && !isPending && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="mr-1 text-sm font-semibold text-ink">En un minuto sabrás:</span>
            {[
              ["📝", "Qué publicaciones gustan"],
              ["🕒", "Cuándo publicar"],
              ["📣", "Qué cambiar en tus campañas"],
              ["💡", "Ideas listas para copiar"],
            ].map(([icon, text]) => (
              <span key={text} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs font-semibold text-ink">
                <span aria-hidden="true">{icon}</span>
                {text}
              </span>
            ))}
          </div>
        )}

        {d?.anuncios && (
          <div role="tablist" aria-label="Qué diagnóstico ver" className="fl-seg grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
            {(
              [
                ["contenido", "📝 Publicaciones"],
                ["anuncios", "📣 Anuncios"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className="fl-seg-item px-4">
                {label}
              </button>
            ))}
          </div>
        )}

        {d?.anuncios && current && view === "anuncios" && <AdsDiagnosisView a={d.anuncios} generatedAt={current.generatedAt} />}

        {d && v && current && (view === "contenido" || !d.anuncios) && (
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
              <div role="tablist" aria-label="Detalle del diagnóstico" className="fl-seg grid w-full grid-cols-3">
                {TABS.map((t) => {
                  const count = t.key === "todo" ? Math.max(0, d.recomendaciones.length - 1) : t.key === "good" ? d.funciona.length : d.noFunciona.length;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className="fl-seg-item min-w-0 px-1.5 py-2.5 text-[13px] sm:text-sm"
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
