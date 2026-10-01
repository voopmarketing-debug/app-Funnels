"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWebsitePageV2, websiteCreationChat } from "@/lib/actions";
import { PAGE_TYPE_LABELS, STYLE_INFO, STYLE_KEYS, type PageType, type StyleKey } from "@/lib/websiteContentV2";
import { ScaledPagePreview } from "@/components/ScaledPagePreview";

type Proposal = { title: string; pageType: PageType; style: StyleKey; why: string; brief: string };
type Ready = { pageType: PageType; style: StyleKey; name: string; purpose: string; brief: string };
type ChatMessage = { role: "user" | "assistant"; text: string; proposals?: Proposal[] };

const PAGE_TYPE_PITCH: Record<PageType, { icon: string; text: string }> = {
  servicios: { icon: "💼", text: "Muestra lo que haces y lleva a tus clientes a escribirte." },
  producto: { icon: "📦", text: "Un producto protagonista con todo para comprarlo." },
  tienda: { icon: "🛍️", text: "Tu catálogo completo, con pedidos por WhatsApp." },
  evento: { icon: "🎤", text: "Llena los cupos de tu evento, clase o lanzamiento." },
  captacion: { icon: "📅", text: "Consigue datos de clientes interesados y agenda citas." },
};

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
export function CreationStudio({
  businessId,
  businessName,
  productCount,
  needsWhatsapp = false,
  initialBrand = { primary: null, secondary: null },
}: {
  businessId: string;
  businessName: string;
  productCount: number;
  needsWhatsapp?: boolean;
  initialBrand?: { primary: string | null; secondary: string | null };
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Ready | null>(null);
  const [building, setBuilding] = useState(false);
  const [step, setStep] = useState(0);
  const [fullPreview, setFullPreview] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const whatsappMissing = needsWhatsapp && (whatsappDigits.length < 8 || whatsappDigits.length > 15);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  // Brand colors: null = let the style decide.
  const [brandPrimary, setBrandPrimary] = useState<string | null>(initialBrand.primary);
  const [brandSecondary, setBrandSecondary] = useState<string | null>(initialBrand.secondary);
  // The previews reload with the color only once the picker settles, not
  // on every drag step (each style card is a live page).
  const [previewColor, setPreviewColor] = useState<string | null>(initialBrand.primary);
  useEffect(() => {
    const id = setTimeout(() => setPreviewColor(brandPrimary), 500);
    return () => clearTimeout(id);
  }, [brandPrimary]);
  const previewSrc = (style: StyleKey, pageType: PageType) =>
    `/dashboard/businesses/${businessId}/website/muestra?style=${style}&type=${pageType}${previewColor ? `&color=${encodeURIComponent(previewColor)}` : ""}`;
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
    // "Crear página" typed or tapped once the plan is ready means build it,
    // not another chat turn.
    if (plan && /^(✦\s*)?crear( mi)? p[aá]gina[.!]?$/i.test(t)) {
      setInput("");
      build();
      return;
    }
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
    if (whatsappMissing) {
      setError(null);
      document.getElementById("whatsapp-number")?.focus();
      document.getElementById("whatsapp-number")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
          whatsappNumber: needsWhatsapp ? whatsapp : undefined,
          brandPrimaryColor: brandPrimary,
          brandSecondaryColor: brandPrimary ? brandSecondary : null,
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
          <div className="w-72 overflow-hidden rounded-xl border border-border shadow-lg">
            <ScaledPagePreview src={previewSrc(plan.style, plan.pageType)} aspect={0.62} title="Tu página" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-7rem)] lg:min-h-[34rem]">
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_27rem]">
        {/* Chat */}
        <section className="fl-card flex h-[70dvh] min-h-0 flex-col overflow-hidden lg:h-auto">
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
                            <ScaledPagePreview src={previewSrc(p.style, p.pageType)} aspect={0.5} title={`Idea: ${p.title}`} />
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
            {plan && !thinking && messages[messages.length - 1]?.role === "assistant" && (
              <div className="ml-11 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">Tu página está lista para crearse.</span>{" "}
                  <span className="text-ink-muted">Mira cómo queda y elige el estilo antes de crearla.</span>
                </p>
                <a href="#plan" className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold lg:hidden">
                  Ver cómo queda
                </a>
                <button type="button" onClick={build} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover">
                  ✦ Crear mi página
                </button>
              </div>
            )}
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
        <aside id="plan" className="fl-card flex min-h-0 flex-col overflow-hidden">
          {plan ? (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-accent">✦ Así se verá tu página</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Esta es tu página con el estilo que elijas. Los textos finales los escribe la IA para {businessName} cuando la crees,
                    y después puedes cambiar lo que quieras.
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                  <ScaledPagePreview
                    key={`${plan.style}-${plan.pageType}`}
                    src={previewSrc(plan.style, plan.pageType)}
                    aspect={0.7}
                    interactive
                    title={`Vista previa en estilo ${STYLE_INFO[plan.style].label}`}
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2">
                    <p className="min-w-0 truncate text-xs">
                      <span className="font-semibold text-ink">{STYLE_INFO[plan.style].label}</span>
                      <span className="text-ink-muted"> · {STYLE_INFO[plan.style].summary}</span>
                    </p>
                    <button type="button" onClick={() => setFullPreview(true)} className="flex-none text-xs font-semibold text-accent hover:underline">
                      Ver en grande
                    </button>
                  </div>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-ink">¿Qué quieres lograr con tu página?</legend>
                  <div className="grid gap-1.5">
                    {(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map((k) => {
                      const needsProducts = (k === "tienda" || k === "producto") && productCount === 0;
                      const active = plan.pageType === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={needsProducts}
                          onClick={() => setPlan({ ...plan, pageType: k })}
                          aria-pressed={active}
                          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition disabled:opacity-50 ${
                            active ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"
                          }`}
                        >
                          <span className="text-lg leading-6" aria-hidden="true">{PAGE_TYPE_PITCH[k].icon}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-ink">{PAGE_TYPE_LABELS[k]}</span>
                            <span className="block text-xs text-ink-muted">
                              {needsProducts ? "Primero carga tus productos en Productos." : PAGE_TYPE_PITCH[k].text}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-ink">Elige el estilo que va con tu marca</legend>
                  <div className="grid grid-cols-2 gap-2.5">
                    {STYLE_KEYS.map((k) => {
                      const active = plan.style === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setPlan({ ...plan, style: k })}
                          aria-pressed={active}
                          className={`overflow-hidden rounded-lg border-2 text-left transition ${active ? "border-accent" : "border-border hover:border-border-strong"}`}
                        >
                          <ScaledPagePreview src={previewSrc(k, plan.pageType)} aspect={0.62} title={`Estilo ${STYLE_INFO[k].label}`} />
                          <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                            <span className="truncate text-xs font-semibold text-ink">{STYLE_INFO[k].label}</span>
                            {active && <span className="text-xs text-accent">✓</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-ink">Los colores de tu marca</legend>
                  <p className="text-xs text-ink-muted">
                    {brandPrimary
                      ? "Tu página usará tu color en botones y detalles, con el estilo que elegiste."
                      : "Opcional. Si no eliges, usamos los colores del estilo."}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {(
                      [
                        ["Principal", brandPrimary, setBrandPrimary],
                        ["Secundario", brandSecondary, setBrandSecondary],
                      ] as const
                    ).map(([label, value, set]) => (
                      <label key={label} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs text-ink-muted">
                        <input
                          type="color"
                          value={value ?? "#1f6feb"}
                          onChange={(e) => set(e.target.value)}
                          disabled={label === "Secundario" && !brandPrimary}
                          aria-label={`Color ${label.toLowerCase()} de tu marca`}
                          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:opacity-40"
                        />
                        <span>
                          <span className="block font-semibold text-ink">{label}</span>
                          <span className="font-mono">{value ?? "Sin elegir"}</span>
                        </span>
                      </label>
                    ))}
                    {brandPrimary && (
                      <button
                        type="button"
                        onClick={() => {
                          setBrandPrimary(null);
                          setBrandSecondary(null);
                        }}
                        className="text-xs text-ink-muted underline hover:text-ink"
                      >
                        Usar los del estilo
                      </button>
                    )}
                  </div>
                </fieldset>

                <label className="block space-y-1.5">
                  <span className="block text-sm font-semibold text-ink">Lo que va a contar tu página</span>
                  <span className="block text-xs text-ink-muted">
                    La IA lo resumió de lo que conversaron y de lo que ya sabe de tu negocio: tu agente, tus productos y lo que preguntan tus
                    clientes. Ajústalo con tus palabras si quieres.
                  </span>
                  <textarea
                    value={plan.brief}
                    onChange={(e) => setPlan({ ...plan, brief: e.target.value })}
                    rows={5}
                    className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
              </div>
              <div className="border-t border-border bg-surface p-3">
                {needsWhatsapp && (
                  <label className="mb-3 block space-y-1">
                    <span className="block text-sm font-semibold text-ink">¿A qué WhatsApp te van a escribir tus clientes?</span>
                    <input
                      id="whatsapp-number"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+57 300 123 4567"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm"
                    />
                    <span className="block text-xs text-ink-muted">Todos los botones de tu página llevan a este número. Lo guardamos en tu perfil.</span>
                  </label>
                )}
                <button type="button" onClick={build} className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold text-accent-ink transition hover:bg-accent-hover">
                  ✦ Crear mi página
                </button>
                <p className="mt-1.5 text-center text-xs text-ink-faint">Lista en un minuto · Podrás editar todo después</p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-5 p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-accent">✦ Tu página, hecha para vender</p>
                <h2 className="mt-2 text-lg font-bold text-ink">Una página profesional, sin escribir una línea</h2>
                <p className="mt-1 text-sm text-ink-muted">La IA ya conoce tu negocio. Tú solo eliges la idea y el estilo.</p>
              </div>
              <ol className="space-y-3 text-sm">
                {[
                  ["Elige una idea", "Toca una de las propuestas o cuéntale a la IA lo que tienes en mente."],
                  ["Mira cómo queda", "Aquí verás tu página en vivo y podrás probar los 12 estilos."],
                  ["Créala en un minuto", "La IA escribe los textos y arma el diseño por ti."],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                    <span>
                      <span className="block font-semibold text-ink">{title}</span>
                      <span className="block text-ink-muted">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {fullPreview && plan && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label="Vista previa">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 pb-3">
            <div className="inline-flex rounded-lg border border-white/20 bg-black/40 p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${device === d ? "bg-white text-black" : "text-white/80"}`}
                >
                  {d === "desktop" ? "Computador" : "Celular"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setFullPreview(false)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black">
              Cerrar
            </button>
          </div>
          <div className={`mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-white ${device === "mobile" ? "max-w-[390px]" : "max-w-6xl"}`}>
            <iframe src={previewSrc(plan.style, plan.pageType)} title="Vista previa completa" className="h-full w-full border-0" />
          </div>
        </div>
      )}
    </div>
  );
}
