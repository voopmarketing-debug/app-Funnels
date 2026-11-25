"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearWebsiteCreationDraft, createWebsitePageV2, saveWebsiteCreationDraft, websiteCreationChat } from "@/lib/actions";
import { PAGE_TYPE_LABELS, STYLE_INFO, STYLE_KEYS, type PageType, type StyleKey } from "@/lib/websiteContentV2";
import { ScaledPagePreview } from "@/components/ScaledPagePreview";
import { DevicePreviewFrame } from "@/components/DevicePreviewFrame";
import { ColorCodeInput } from "@/components/ColorCodeInput";
import { ColorSwatchButton } from "@/components/ColorSwatchButton";
import { recommendPalette } from "@/lib/designIntel";
import { askConfirm } from "@/components/ConfirmHost";

type Proposal = { title: string; pageType: PageType; style: StyleKey; why: string; brief: string };
type Ready = { pageType: PageType; style: StyleKey; name: string; purpose: string; brief: string };
type ChatMessage = { role: "user" | "assistant"; text: string; proposals?: Proposal[] };

const PAGE_TYPE_PITCH: Record<PageType, { icon: string; text: string }> = {
  servicios: { icon: "💼", text: "Muestra lo que haces y lleva a tus clientes a escribirte." },
  producto: { icon: "📦", text: "Un producto protagonista con todo para comprarlo." },
  tienda: { icon: "🛍️", text: "Tu catálogo completo, con pedidos por WhatsApp." },
  evento: { icon: "🎤", text: "Llena los cupos de tu evento, clase o lanzamiento." },
  captacion: { icon: "📅", text: "Consigue datos de clientes interesados y agenda citas." },
  showroom: { icon: "🚗", text: "Visor para girar el producto, cotizador por presupuesto y ofertas del mes." },
  historia: { icon: "✨", text: "Tu marca contada al bajar: producto protagonista, colección en abanico y movimiento." },
};

// One-tap improvements offered once an idea is chosen, by page type. Each adds a sentence to the
// brief the page is built from, so none of them can invent data: they only ask for a piece, and
// the generator keeps its rule of using real data (offers, prices, hours) or leaving it out.
const ENHANCERS: Record<PageType, { id: string; label: string; text: string }[]> = {
  showroom: [
    { id: "visor", label: "Visor para girar el producto", text: "Que el producto protagonista se pueda girar y comparar con otros." },
    { id: "cotizador", label: "Cotizador por presupuesto", text: "Incluye el cotizador por presupuesto para que vea cuáles le alcanzan." },
    { id: "oferta", label: "Oferta del mes con cuenta regresiva", text: "Incluye un banner de la oferta del mes con cuenta regresiva, solo si hay una oferta real; sin inventar descuentos." },
    { id: "retoma", label: "Recibimos tu producto actual", text: "Incluye una franja destacada de recibimos tu producto actual como parte de pago, solo si el negocio lo ofrece." },
    { id: "agendar", label: "Todo lleva a agendar visita", text: "Cada parte de la página debe llevar al formulario para agendar una visita." },
  ],
  historia: [
    { id: "ingredientes", label: "Lo que hay adentro", text: "Incluye una sección de lo que hay adentro del producto, solo con datos reales." },
    { id: "pasos", label: "Pasos de la primera visita", text: "Incluye los pasos de la primera visita o compra." },
    { id: "oferta", label: "Oferta del mes", text: "Incluye un banner de la oferta del mes, solo si hay una oferta real; sin inventar descuentos." },
    { id: "agendar", label: "Todo lleva a agendar", text: "Cada parte de la página debe llevar al formulario para agendar." },
  ],
  servicios: [
    { id: "faq", label: "Preguntas frecuentes", text: "Incluye una sección de preguntas frecuentes con las dudas reales de sus clientes." },
    { id: "pasos", label: "Cómo trabajamos, en pasos", text: "Explica en pasos cómo es trabajar con el negocio." },
    { id: "oferta", label: "Oferta destacada", text: "Incluye una oferta destacada, solo si hay una real; sin inventar descuentos." },
    { id: "formulario", label: "Formulario para agendar", text: "Termina con un formulario corto para que el cliente deje sus datos y agende." },
  ],
  producto: [
    { id: "beneficios", label: "Beneficios clave", text: "Resalta los beneficios clave del producto, uno por uno." },
    { id: "faq", label: "Preguntas frecuentes", text: "Incluye preguntas frecuentes sobre compra, envío y uso." },
    { id: "oferta", label: "Oferta con cuenta regresiva", text: "Incluye una oferta con cuenta regresiva, solo si hay una real; sin inventar descuentos." },
    { id: "whatsapp", label: "Comprar por WhatsApp", text: "Que el botón principal lleve a comprar por WhatsApp." },
  ],
  tienda: [
    { id: "categorias", label: "Categorías destacadas", text: "Destaca las categorías principales del catálogo." },
    { id: "oferta", label: "Oferta con cuenta regresiva", text: "Incluye una oferta con cuenta regresiva, solo si hay una real; sin inventar descuentos." },
    { id: "whatsapp", label: "Pedidos por WhatsApp", text: "Que cada producto se pueda pedir por WhatsApp." },
    { id: "faq", label: "Envíos y pagos", text: "Incluye preguntas frecuentes sobre envíos y formas de pago." },
  ],
  evento: [
    { id: "cuenta", label: "Cuenta regresiva al evento", text: "Incluye una cuenta regresiva hacia la fecha del evento." },
    { id: "programa", label: "Programa o agenda", text: "Incluye el programa o la agenda del evento, solo con datos reales." },
    { id: "cupos", label: "Cupos limitados", text: "Resalta que los cupos son limitados, solo si es verdad." },
    { id: "faq", label: "Preguntas frecuentes", text: "Incluye preguntas frecuentes sobre el evento." },
  ],
  captacion: [
    { id: "pasos", label: "Cómo funciona, en pasos", text: "Explica en pasos cómo funciona el servicio." },
    { id: "faq", label: "Preguntas frecuentes", text: "Incluye preguntas frecuentes con las dudas reales de sus clientes." },
    { id: "oferta", label: "Oferta destacada", text: "Incluye una oferta destacada, solo si hay una real; sin inventar descuentos." },
    { id: "formulario", label: "Formulario corto", text: "Que el formulario sea corto: nombre y WhatsApp." },
  ],
};

// The conversation is kept on the server (per person and business) and also in this browser, so a
// reload, the phone unloading the page, another device or a cleared browser never loses what was
// being decided, and coming back does not ask the AI to read the business again (that costs).
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
type Draft = {
  at: number;
  messages: ChatMessage[];
  quickReplies: string[];
  plan: Ready | null;
  extras: string[];
  brandPrimary: string | null;
  brandSecondary: string | null;
  whatsapp: string;
  input: string;
};
const HEX = /^#[0-9a-fA-F]{6}$/;

function draftKey(businessId: string) {
  return `fl-website-creation:v2:${businessId}`;
}

/** Saved data (from the server or the browser) → a draft, or null when it is old or damaged. */
function parseDraft(raw: unknown): Draft | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const data = raw as Record<string, unknown>;
    if (typeof data.at !== "number" || Date.now() - data.at > DRAFT_TTL_MS) return null;
    if (!Array.isArray(data.messages)) return null;
    const messages = data.messages.filter(
      (m): m is ChatMessage => !!m && typeof m === "object" && ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") && typeof (m as ChatMessage).text === "string",
    );
    if (messages.length === 0) return null;
    const plan = data.plan as Ready | null;
    const planOk = !!plan && typeof plan === "object" && plan.pageType in PAGE_TYPE_LABELS && STYLE_KEYS.includes(plan.style) && typeof plan.brief === "string" && typeof plan.name === "string" && typeof plan.purpose === "string";
    const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : null);
    return {
      at: data.at,
      messages,
      quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies.filter((q): q is string => typeof q === "string").slice(0, 4) : [],
      plan: planOk ? plan : null,
      extras: Array.isArray(data.extras) ? data.extras.filter((e): e is string => typeof e === "string") : [],
      brandPrimary: hex(data.brandPrimary),
      brandSecondary: hex(data.brandSecondary),
      whatsapp: typeof data.whatsapp === "string" ? data.whatsapp.slice(0, 40) : "",
      input: typeof data.input === "string" ? data.input.slice(0, 8000) : "",
    };
  } catch {
    return null;
  }
}

function readLocalDraft(businessId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(businessId));
    return raw ? parseDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(businessId: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(businessId), JSON.stringify(draft));
  } catch {
    // Storage blocked or full: the server copy still keeps it.
  }
}

function clearLocalDraft(businessId: string) {
  try {
    window.localStorage.removeItem(draftKey(businessId));
  } catch {
    // Nothing to clear.
  }
}

// Short names for the compact options in the chat.
const PAGE_TYPE_SHORT: Record<PageType, string> = {
  servicios: "Servicios",
  producto: "Un producto",
  tienda: "Tienda",
  evento: "Evento",
  captacion: "Captar clientes",
  showroom: "Showroom",
  historia: "Historia de marca",
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
  showcaseCount,
  needsWhatsapp = false,
  initialBrand = { primary: null, secondary: null },
  savedDraft = null,
}: {
  businessId: string;
  businessName: string;
  productCount: number;
  // Products with a photo plus photos in the library: what Showroom and Scroll Story pages show.
  showcaseCount?: number;
  needsWhatsapp?: boolean;
  initialBrand?: { primary: string | null; secondary: string | null };
  // What this person was deciding last time (from the server), to continue it.
  savedDraft?: unknown;
}) {
  const router = useRouter();
  const [serverDraft] = useState(() => parseDraft(savedDraft));
  const [messages, setMessages] = useState<ChatMessage[]>(serverDraft?.messages ?? []);
  const [quickReplies, setQuickReplies] = useState<string[]>(serverDraft?.quickReplies ?? []);
  const [input, setInput] = useState(serverDraft?.input ?? "");
  const [thinking, setThinking] = useState(!serverDraft);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Ready | null>(serverDraft?.plan ?? null);
  const [building, setBuilding] = useState(false);
  // Phones: the conversation fills the screen; the plan (preview + create button) is a second full screen.
  const [mobilePlan, setMobilePlan] = useState(false);
  // Improvements ticked in the plan panel (ids from ENHANCERS).
  const [extras, setExtras] = useState<string[]>(serverDraft?.extras ?? []);
  const [step, setStep] = useState(0);
  // The big preview: of the plan's page, or of an idea before it is chosen.
  const [fullPreview, setFullPreview] = useState<{ style: StyleKey; pageType: PageType; title?: string; proposal?: Proposal } | null>(null);
  const [whatsapp, setWhatsapp] = useState(serverDraft?.whatsapp ?? "");
  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const whatsappMissing = needsWhatsapp && (whatsappDigits.length < 8 || whatsappDigits.length > 15);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  // Brand colors: null = let the style decide.
  const [brandPrimary, setBrandPrimary] = useState<string | null>(serverDraft ? serverDraft.brandPrimary : initialBrand.primary);
  const [brandSecondary, setBrandSecondary] = useState<string | null>(serverDraft ? serverDraft.brandSecondary : initialBrand.secondary);
  // The previews reload with the color only once the picker settles, not
  // on every drag step (each style card is a live page).
  const [previewColor, setPreviewColor] = useState<string | null>(serverDraft ? serverDraft.brandPrimary : initialBrand.primary);
  useEffect(() => {
    const id = setTimeout(() => setPreviewColor(brandPrimary), 500);
    return () => clearTimeout(id);
  }, [brandPrimary]);
  const previewSrc = (style: StyleKey, pageType: PageType) =>
    `/dashboard/businesses/${businessId}/website/muestra?style=${style}&type=${pageType}${previewColor ? `&color=${encodeURIComponent(previewColor)}` : ""}`;
  // Colors recommended for this kind of business (from its name and what the page is about).
  const suggestedColors = (() => {
    if (!plan) return [] as string[];
    const p = recommendPalette(`${businessName}. ${plan.name}. ${plan.purpose}. ${plan.brief}`);
    return p ? [p.accent, p.primary, p.secondary, p.bg, p.fg] : [];
  })();
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

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

  const saveTimer = useRef<number | undefined>(undefined);
  const lastDraft = useRef<Draft | null>(null);
  const savingOff = useRef(false);

  useEffect(() => {
    // The server's copy is already on screen. If this browser has a newer one (the page was
    // unloaded before the server got the last change), use that.
    const local = readLocalDraft(businessId);
    if (local && (!serverDraft || local.at > serverDraft.at)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setMessages(local.messages);
      setQuickReplies(local.quickReplies);
      setPlan(local.plan);
      setExtras(local.extras);
      setBrandPrimary(local.brandPrimary);
      setBrandSecondary(local.brandSecondary);
      setPreviewColor(local.brandPrimary);
      setWhatsapp(local.whatsapp);
      setInput(local.input);
      setThinking(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    if (serverDraft) return;
    // Deferred a tick: React rejects a Server Function call made while the
    // page is still hydrating ("cannot be called during initial render").
    const id = setTimeout(() => void ask([]), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep everything as it changes: at once in this browser, and a moment later on the server.
  useEffect(() => {
    if (messages.length === 0 || savingOff.current) return;
    const draft: Draft = { at: Date.now(), messages, quickReplies, plan, extras, brandPrimary, brandSecondary, whatsapp, input };
    lastDraft.current = draft;
    writeLocalDraft(businessId, draft);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveWebsiteCreationDraft(businessId, draft), 1200);
  }, [businessId, messages, quickReplies, plan, extras, brandPrimary, brandSecondary, whatsapp, input]);

  // When the page goes to the background (the phone may unload it right after), send it now.
  useEffect(() => {
    const flush = () => {
      const draft = lastDraft.current;
      if (draft && !savingOff.current && document.visibilityState === "hidden") void saveWebsiteCreationDraft(businessId, draft);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [businessId]);

  function discardDraft() {
    savingOff.current = true;
    window.clearTimeout(saveTimer.current);
    lastDraft.current = null;
    clearLocalDraft(businessId);
    void clearWebsiteCreationDraft(businessId);
  }

  async function startOver() {
    if (!(await askConfirm({ title: "¿Empezar de nuevo?", message: "Se borra esta conversación y la IA propone ideas desde cero.", confirmLabel: "Sí, empezar de nuevo" }))) return;
    discardDraft();
    setMessages([]);
    setQuickReplies([]);
    setPlan(null);
    setExtras([]);
    setInput("");
    savingOff.current = false;
    void ask([]);
  }

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
    // The business is already known, so choosing an idea goes straight to the plan: no extra
    // question. The improvements and the rest of the options are on the right.
    setPlan({ pageType: p.pageType, style: p.style, name: p.title, purpose: p.why, brief: p.brief });
    setMobilePlan(true);
    setExtras([]);
    setQuickReplies([]);
    setMessages((m) => [
      ...m,
      { role: "user", text: `Me gusta la idea "${p.title}".` },
      { role: "assistant", text: "Perfecto. Puedes mejorarla con un toque o crearla ya mismo." },
    ]);
    window.setTimeout(() => optionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  /** The brief the page is built from: the idea plus the improvements ticked. */
  function finalBrief(current: Ready): string {
    const picked = (ENHANCERS[current.pageType] ?? []).filter((e) => extras.includes(e.id)).map((e) => e.text);
    return picked.length ? `${current.brief}\n\nAdemás: ${picked.join(" ")}` : current.brief;
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
          brief: finalBrief(plan),
          pageType: plan.pageType,
          style: plan.style,
          whatsappNumber: needsWhatsapp ? whatsapp : undefined,
          brandPrimaryColor: brandPrimary,
          brandSecondaryColor: brandPrimary ? brandSecondary : null,
        });
        if (!result.ok) throw new Error(result.error);
        discardDraft();
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
      <div className="hidden flex-wrap items-center justify-between gap-2 lg:flex">
        <div>
          <Link href={`/dashboard/businesses/${businessId}/website`} className="text-sm text-ink-muted underline hover:text-ink">
            ← Sitios web
          </Link>
          <h1 className="mt-1 text-xl font-bold">Crear página con IA</h1>
        </div>
        {messages.length > 0 && !thinking && (
          <button type="button" onClick={() => void startOver()} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">
            ↺ Empezar de nuevo
          </button>
        )}
        {productCount === 0 && (
          <Link href={`/dashboard/businesses/${businessId}/productos`} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent">
            🛍️ ¿Vendes productos? Cárgalos primero
          </Link>
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_27rem]">
        {/* Chat */}
        <section className="fl-card fixed inset-0 z-[60] flex min-h-0 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top,0px)] max-lg:rounded-none max-lg:border-0 max-lg:shadow-none lg:static lg:z-auto lg:h-auto lg:bg-transparent lg:pt-0">
          {/* Phones: a slim bar, like a chat app: back, title, and the way to the page being built. */}
          <div className="flex flex-none items-center gap-2 border-b border-border bg-surface px-2 py-2 lg:hidden">
            <Link href={`/dashboard/businesses/${businessId}/website`} aria-label="Volver a Sitios web" className="flex h-10 w-9 flex-none items-center justify-center text-3xl leading-none text-ink-muted">
              ‹
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">Crear con IA</p>
              <p className="truncate text-[12px] text-ink-muted">{plan ? "Ya elegiste una idea" : "Cuéntale qué página quieres"}</p>
            </div>
            {plan && (
              <button type="button" onClick={() => setMobilePlan(true)} className="h-10 flex-none rounded-full bg-accent px-3 text-xs font-bold text-accent-ink">
                Ver mi página ›
              </button>
            )}
            {messages.length > 0 && !thinking && (
              <button type="button" onClick={() => void startOver()} aria-label="Empezar de nuevo" title="Empezar de nuevo" className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border text-lg text-ink-muted">
                ↺
              </button>
            )}
          </div>
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
                      <div className="grid gap-3 sm:grid-cols-2 lg:pl-11 xl:grid-cols-3">
                        {m.proposals.map((p, j) => (
                          <div key={j} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background text-left transition hover:border-accent">
                            <button
                              type="button"
                              onClick={() => setFullPreview({ style: p.style, pageType: p.pageType, title: p.title, proposal: p })}
                              className="block text-left"
                              aria-label={`Ver página: ${p.title}`}
                            >
                              <ScaledPagePreview src={previewSrc(p.style, p.pageType)} aspect={0.5} title={`Idea: ${p.title}`} />
                            </button>
                            <div className="flex flex-1 flex-col gap-1 p-3">
                              <p className="text-sm font-semibold">{p.title}</p>
                              <p className="text-xs text-ink-muted">
                                {PAGE_TYPE_LABELS[p.pageType]} · {STYLE_INFO[p.style].label}
                              </p>
                              <p className="line-clamp-3 text-xs text-ink-muted">{p.why}</p>
                              <div className="mt-auto flex flex-col gap-1.5 pt-2">
                                <button
                                  type="button"
                                  onClick={() => pickProposal(p)}
                                  disabled={thinking}
                                  className="rounded-lg bg-accent px-2 py-1.5 text-xs font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
                                >
                                  Usar esta idea
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFullPreview({ style: p.style, pageType: p.pageType, title: p.title, proposal: p })}
                                  className="rounded-lg border border-border px-2 py-1.5 text-xs font-semibold hover:border-accent"
                                >
                                  Ver página
                                </button>
                              </div>
                            </div>
                          </div>
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
              <div ref={optionsRef} className="ml-0 scroll-mt-20 space-y-3.5 rounded-xl border border-accent/40 bg-accent/5 p-3 sm:ml-11">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">Así queda tu página</p>
                    <p className="text-xs text-ink-muted">Toca lo que quieras cambiar. Todo se guarda solo. <a href="#plan" onClick={() => setMobilePlan(true)} className="font-semibold text-accent hover:underline">Revisar el texto</a></p>
                  </div>
                  <button type="button" onClick={build} className="flex-none rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover">
                    ✦ Crear
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm lg:hidden">
                  <ScaledPagePreview key={`chat-${plan.style}-${plan.pageType}`} src={previewSrc(plan.style, plan.pageType)} aspect={0.42} title={`Vista previa en estilo ${STYLE_INFO[plan.style].label}`} />
                  <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-1.5">
                    <p className="min-w-0 truncate text-xs font-semibold text-ink">{STYLE_INFO[plan.style].label}</p>
                    <button type="button" onClick={() => setFullPreview({ style: plan.style, pageType: plan.pageType })} className="flex-none text-xs font-semibold text-accent hover:underline">
                      Ver página
                    </button>
                  </div>
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">Qué quieres lograr</legend>
                  {/* Phones: a dropdown (every option visible in the picker). Wider screens: all the chips. */}
                  <select
                    aria-label="Qué quieres lograr con tu página"
                    value={plan.pageType}
                    onChange={(e) => {
                      setPlan({ ...plan, pageType: e.target.value as PageType });
                      setExtras([]);
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-ink outline-none focus:border-accent sm:hidden"
                  >
                    {(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map((k) => {
                      const needsProducts = k === "tienda" || k === "producto" ? productCount === 0 : k === "showroom" || k === "historia" ? (showcaseCount ?? productCount) === 0 : false;
                      return (
                        <option key={k} value={k} disabled={needsProducts}>
                          {PAGE_TYPE_PITCH[k].icon} {PAGE_TYPE_SHORT[k]}
                          {needsProducts ? " (primero sube fotos en Productos)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <div className="hidden flex-wrap gap-1.5 sm:flex">
                    {(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map((k) => {
                      const needsProducts = k === "tienda" || k === "producto" ? productCount === 0 : k === "showroom" || k === "historia" ? (showcaseCount ?? productCount) === 0 : false;
                      const active = plan.pageType === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={needsProducts}
                          aria-pressed={active}
                          title={needsProducts ? "Primero sube fotos de tus productos en Productos" : PAGE_TYPE_PITCH[k].text}
                          onClick={() => {
                            setPlan({ ...plan, pageType: k });
                            setExtras([]);
                          }}
                          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 ${active ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-accent hover:text-ink"}`}
                        >
                          <span aria-hidden="true">{PAGE_TYPE_PITCH[k].icon} </span>
                          {PAGE_TYPE_SHORT[k]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="hidden text-xs text-ink-muted sm:block">{PAGE_TYPE_PITCH[plan.pageType].text}</p>
                </fieldset>

                {plan.pageType !== "showroom" && plan.pageType !== "historia" && (
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">Estilo</legend>
                    <select
                      aria-label="Estilo de la página"
                      value={plan.style}
                      onChange={(e) => setPlan({ ...plan, style: e.target.value as StyleKey })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-ink outline-none focus:border-accent sm:hidden"
                    >
                      {STYLE_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {STYLE_INFO[k].label}
                        </option>
                      ))}
                    </select>
                    <div className="hidden flex-wrap gap-1.5 sm:flex">
                      {STYLE_KEYS.map((k) => {
                        const active = plan.style === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setPlan({ ...plan, style: k })}
                            aria-pressed={active}
                            title={STYLE_INFO[k].summary}
                            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition ${active ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-accent hover:text-ink"}`}
                          >
                            {active ? "✓ " : ""}
                            {STYLE_INFO[k].label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="hidden text-xs text-ink-muted sm:block">{STYLE_INFO[plan.style].summary}</p>
                  </fieldset>
                )}

                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">Mejora tu idea con un toque</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {(ENHANCERS[plan.pageType] ?? []).map((e) => {
                      const on = extras.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setExtras((x) => (on ? x.filter((i) => i !== e.id) : [...x, e.id]))}
                          className={`rounded-full border px-2.5 py-1 text-left text-xs font-semibold transition ${on ? "border-accent bg-accent/15 text-ink" : "border-border text-ink-muted hover:border-accent hover:text-ink"}`}
                        >
                          {on ? "✓ " : "+ "}
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">Colores de tu marca (opcional)</legend>
                  <p className="text-[12px] text-ink-muted">Toca el cuadro de color: se abre la paleta y ves cómo cambia al instante.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {(
                      [
                        ["Principal", brandPrimary, setBrandPrimary],
                        ["Secundario", brandSecondary, setBrandSecondary],
                      ] as const
                    ).map(([label, value, set]) => (
                      <div key={label} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
                        <ColorSwatchButton
                          value={value}
                          label={`color ${label.toLowerCase()}`}
                          disabled={label === "Secundario" && !brandPrimary}
                          suggestions={suggestedColors}
                          sizeClass="h-9 w-9"
                          onChange={(hex) => set(hex)}
                          onClear={() => set(null)}
                        />
                        <span className="text-xs font-semibold text-ink">{label}</span>
                        <ColorCodeInput
                          value={value}
                          label={`color ${label.toLowerCase()}`}
                          disabled={label === "Secundario" && !brandPrimary}
                          onChange={(hex) => set(hex)}
                        />
                      </div>
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

          <div className="flex-none space-y-2 border-t border-border bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:bg-transparent">
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
                className="max-h-64 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-ink outline-none placeholder:text-ink-faint md:text-sm"
              />
              <button type="submit" disabled={thinking || !input.trim()} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                Enviar
              </button>
            </form>
          </div>
        </section>

        {/* Plan */}
        <aside id="plan" className={`fl-card min-h-0 flex-col overflow-hidden ${mobilePlan ? "fixed inset-0 z-[61] flex bg-background pt-[env(safe-area-inset-top,0px)] max-lg:rounded-none max-lg:border-0 lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:pt-0" : "hidden lg:flex"}`}>
          <div className="flex flex-none items-center gap-2 border-b border-border bg-surface px-2 py-2 lg:hidden">
            <button type="button" onClick={() => setMobilePlan(false)} className="flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-muted">‹ Volver al chat</button>
          </div>
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

                <div className="hidden overflow-hidden rounded-xl border border-border shadow-sm lg:block">
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
                    <button type="button" onClick={() => setFullPreview({ style: plan.style, pageType: plan.pageType })} className="flex-none text-xs font-semibold text-accent hover:underline">
                      Ver página
                    </button>
                  </div>
                </div>

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

      {fullPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label="Vista previa">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 pb-3">
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
            {fullPreview.title && <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white">{fullPreview.title}</p>}
            <div className="flex gap-2">
              {fullPreview.proposal && (
                <button
                  type="button"
                  onClick={() => {
                    const p = fullPreview.proposal!;
                    setFullPreview(null);
                    pickProposal(p);
                  }}
                  disabled={thinking}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
                >
                  Usar esta idea
                </button>
              )}
              <button type="button" onClick={() => setFullPreview(null)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black">
                {fullPreview.proposal ? "Ver otras ideas" : "Cerrar"}
              </button>
            </div>
          </div>
          <div className={`mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-white ${device === "mobile" ? "max-w-[390px]" : "max-w-6xl"}`}>
            <DevicePreviewFrame src={previewSrc(fullPreview.style, fullPreview.pageType)} device={device} />
          </div>
        </div>
      )}
    </div>
  );
}
