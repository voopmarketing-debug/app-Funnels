"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWebsitePageV2, websiteCreationChat } from "@/lib/actions";
import { PAGE_TYPE_LABELS, STYLE_INFO, STYLE_KEYS, type PageType, type StyleKey } from "@/lib/websiteContentV2";
import { StyleThumb } from "@/components/StyleThumb";

type Proposal = { title: string; pageType: PageType; style: StyleKey; why: string; brief: string };
type Ready = { pageType: PageType; style: StyleKey; name: string; purpose: string; brief: string };
type ChatMessage = { role: "user" | "assistant"; text: string; proposals?: Proposal[] };

const BUILD_STEPS = [
  "Analizando tu negocio y tus clientes…",
  "Definiendo la estrategia de la página…",
  "Escribiendo los textos que venden…",
  "Eligiendo colores y tipografías…",
  "Armando las secciones…",
  "Últimos detalles de diseño…",
];

/**
 * "Crear con IA" — a Lovable-style studio: the AI reads what the business
 * already has in the platform, proposes concrete page ideas, asks only
 * what's missing, and builds the page when the brief is ready. The right
 * side keeps the plan visible (type + style + brief) and editable.
 */
export function CreationStudio({ businessId, businessName, productCount }: { businessId: string; businessName: string; productCount: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Ready | null>(null);
  const [building, setBuilding] = useState(false);
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(history: ChatMessage[]) {
    setThinking(true);
    setError(null);
    try {
      const result = await websiteCreationChat(
        businessId,
        history.map((m) => ({ role: m.role, text: m.text })),
      );
      if (!result.ok) throw new Error(result.error);
      const turn = result.turn;
      setMessages([...history, { role: "assistant", text: turn.reply, proposals: turn.proposals }]);
      setQuickReplies(turn.quickReplies.slice(0, 4));
      if (turn.ready) setPlan(turn.ready);
    } catch (err) {
      setError(err instanceof Error ? err.message : "El asistente no pudo responder");
      setMessages(history);
    } finally {
      setThinking(false);
    }
  }

  useEffect(() => {
    // Deferred a tick: React rejects a Server Function call made while the
    // page is still hydrating ("cannot be called during initial render").
    const id = setTimeout(() => void ask([]), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (!building) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, BUILD_STEPS.length - 1)), 7000);
    return () => clearInterval(id);
  }, [building]);

  function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    setInput("");
    setQuickReplies([]);
    const next: ChatMessage[] = [...messages, { role: "user", text: t }];
    setMessages(next);
    void ask(next);
  }

  function pickProposal(p: Proposal) {
    setPlan({ pageType: p.pageType, style: p.style, name: p.title, purpose: p.why, brief: p.brief });
    send(`Me gusta la idea "${p.title}". ${p.brief}`);
  }

  function build() {
    if (!plan) return;
    setBuilding(true);
    setStep(0);
    setError(null);
    startTransition(async () => {
      try {
        const result = await createWebsitePageV2(businessId, {
          name: plan.name,
          purpose: plan.purpose,
          brief: plan.brief,
          pageType: plan.pageType,
          style: plan.style,
        });
        if (!result.ok) throw new Error(result.error);
        router.push(`/dashboard/businesses/${businessId}/website/${result.id}`);
      } catch (err) {
        setBuilding(false);
        setError(err instanceof Error ? err.message : "No se pudo crear la página");
      }
    });
  }

  if (building) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-3xl text-accent-ink">✦</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">Creando tu página</h1>
          <p className="mt-2 text-ink-muted" aria-live="polite">{BUILD_STEPS[step]}</p>
          <p className="mt-1 text-xs text-ink-faint">Tarda alrededor de un minuto. No cierres esta pestaña.</p>
        </div>
        {plan && (
          <div className="w-64 overflow-hidden rounded-xl border border-border">
            <StyleThumb style={plan.style} className="h-36" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[34rem] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/dashboard/businesses/${businessId}/website`} className="text-sm text-ink-muted underline hover:text-ink">
            ← Sitios web
          </Link>
          <h1 className="mt-1 text-xl font-bold">Crear página con IA</h1>
        </div>
        {productCount === 0 && (
          <Link href={`/dashboard/businesses/${businessId}/productos`} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">
            🛍️ ¿Vendes productos? Cárgalos primero
          </Link>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Chat */}
        <section className="fl-card flex min-h-0 flex-col overflow-hidden">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "space-y-3"}>
                {m.role === "assistant" ? (
                  <>
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-sm text-accent-ink">✦</span>
                      <p className="max-w-[46rem] whitespace-pre-line pt-1 text-[15px] leading-relaxed text-ink">{m.text}</p>
                    </div>
                    {m.proposals && m.proposals.length > 0 && (
                      <div className="grid gap-3 pl-11 sm:grid-cols-2 xl:grid-cols-3">
                        {m.proposals.map((p, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => pickProposal(p)}
                            disabled={thinking}
                            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background text-left transition hover:border-accent disabled:opacity-60"
                          >
                            <StyleThumb style={p.style} className="h-24" />
                            <div className="flex flex-1 flex-col gap-1 p-3">
                              <p className="text-sm font-semibold">{p.title}</p>
                              <p className="text-xs text-ink-muted">
                                {PAGE_TYPE_LABELS[p.pageType]} · {STYLE_INFO[p.style].label}
                              </p>
                              <p className="line-clamp-3 text-xs text-ink-muted">{p.why}</p>
                              <span className="mt-auto pt-2 text-xs font-semibold text-accent group-hover:underline">Usar esta idea →</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-tr-md bg-accent/15 px-4 py-2.5 text-[15px] text-ink">{m.text}</p>
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent">✦</span>
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" />
                </span>
                {messages.length === 0 ? `Leyendo la información de ${businessName}…` : "Pensando…"}
              </div>
            )}
            {error && <p className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{error}</p>}
          </div>

          <div className="space-y-2 border-t border-border p-3">
            {quickReplies.length > 0 && !thinking && (
              <div className="flex flex-wrap gap-1.5">
                {quickReplies.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted hover:border-accent hover:text-ink">
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-accent/60"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                placeholder="Cuéntale a la IA qué página quieres: para qué es, a quién le hablas, qué te gusta…"
                className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-ink outline-none placeholder:text-ink-faint md:text-sm"
              />
              <button type="submit" disabled={thinking || !input.trim()} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                Enviar
              </button>
            </form>
          </div>
        </section>

        {/* Plan */}
        <aside className="fl-card flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Tu página</p>
            <p className="mt-1 text-sm text-ink-muted">
              {plan ? "Revisa el plan y créala cuando quieras. Podrás cambiar todo después." : "Elige una idea o conversa con la IA. Aquí verás el plan antes de crearla."}
            </p>
          </div>
          {plan && (
            <>
              <div className="overflow-hidden rounded-xl border border-border">
                <StyleThumb style={plan.style} className="h-32" />
              </div>
              <label className="space-y-1">
                <span className="text-xs text-ink-muted">Tipo de página</span>
                <select
                  value={plan.pageType}
                  onChange={(e) => setPlan({ ...plan, pageType: e.target.value as PageType })}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  {(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map((k) => (
                    <option key={k} value={k} disabled={(k === "tienda" || k === "producto") && productCount === 0}>
                      {PAGE_TYPE_LABELS[k]}
                      {(k === "tienda" || k === "producto") && productCount === 0 ? " (carga productos)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-1">
                <span className="text-xs text-ink-muted">Estilo · {STYLE_INFO[plan.style].label}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {STYLE_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      title={`${STYLE_INFO[k].label}: ${STYLE_INFO[k].summary}`}
                      onClick={() => setPlan({ ...plan, style: k })}
                      className={`overflow-hidden rounded-md border-2 ${plan.style === k ? "border-accent" : "border-transparent hover:border-border-strong"}`}
                    >
                      <StyleThumb style={k} className="h-11 [&>div:last-child]:hidden" />
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-xs text-ink-muted">Brief</span>
                <textarea
                  value={plan.brief}
                  onChange={(e) => setPlan({ ...plan, brief: e.target.value })}
                  rows={6}
                  className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <button type="button" onClick={build} className="mt-auto rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-ink transition hover:bg-accent-hover">
                ✦ Crear página
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
