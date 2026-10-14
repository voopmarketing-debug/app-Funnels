"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyAssistantAction,
  discardAssistantAction,
  getAssistantThread,
  listAssistantThreads,
  sendAssistantMessage,
  type ChatAction,
  type ChatItem,
  type ChatView,
} from "@/lib/assistantActions";

// The Asistente Funnels: a floating ✦ button on every dashboard page that
// opens a chat. Other screens can open it with a ready question:
//   window.dispatchEvent(new CustomEvent("fl-assistant-open", { detail: { text } }))

export const ASSISTANT_OPEN_EVENT = "fl-assistant-open";
const THREAD_KEY = "fl-assistant-thread";

const SUGGESTIONS = [
  "Escríbeme el prompt para mi agente de IA",
  "Lee mis conversaciones y dime cómo mejorar el prompt",
  "Crea una plantilla para recordar citas",
  "Crea una respuesta automática cuando comenten INFO",
  "¿Cómo van mis métricas este mes?",
];

const SECTION_LABELS: [RegExp, string][] = [
  [/\/crm/, "CRM"],
  [/\/analytics/, "KPIs"],
  [/\/templates/, "Plantillas"],
  [/\/website/, "Sitio web"],
  [/\/inventario/, "Inventario"],
  [/\/redes\/comentarios\/automaticas/, "Redes sociales → Respuestas automáticas"],
  [/\/redes\/comentarios/, "Redes sociales → Comentarios"],
  [/\/redes\/mensajes/, "Redes sociales → Mensajes"],
  [/\/redes/, "Redes sociales → Métricas"],
  [/\/conversations\//, "una conversación del CRM"],
  [/\/dashboard\/businesses\/[^/]+$/, "Agente de IA (prompt y configuración)"],
  [/\/dashboard\/clients/, "Clientes"],
  [/\/dashboard\/rentabilidad/, "Rentabilidad"],
  [/\/dashboard\/account/, "Mi perfil"],
  [/\/dashboard\/agentes/, "Agentes de IA"],
];

function pageContext(pathname: string): { businessId: string | null; pageLabel: string | null } {
  const m = pathname.match(/\/dashboard\/businesses\/([^/]+)/);
  const businessId = m && m[1] !== "new" ? m[1] : null;
  const pageLabel = SECTION_LABELS.find(([re]) => re.test(pathname))?.[1] ?? (pathname === "/dashboard" ? "Inicio" : null);
  return { businessId, pageLabel };
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    // Storage blocked: the chat just starts fresh next time.
  }
};

// ---- Minimal, safe Markdown (bold, lists, paragraphs) for the replies ----

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function Markdown({ text }: { text: string }) {
  const blocks: { kind: "p" | "ul" | "ol"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const kind = /^\s*[-*•]\s+/.test(line) ? "ul" : /^\s*\d+[.)]\s+/.test(line) ? "ol" : line.trim() ? "p" : null;
    if (!kind) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const content = line.replace(/^\s*([-*•]|\d+[.)])\s+/, "").replace(/^#+\s*/, "");
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind && (kind !== "p" || last.lines.length)) last.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }
  return (
    <div className="space-y-2">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.kind === "p" ? (
            <p key={i} className="whitespace-pre-wrap">
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Inline text={l} />
                </Fragment>
              ))}
            </p>
          ) : b.kind === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l} />
                </li>
              ))}
            </ul>
          ) : (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l} />
                </li>
              ))}
            </ol>
          ),
        )}
    </div>
  );
}

// ---- Proposal card ----

function ActionCard({ action: initial }: { action: ChatAction }) {
  const router = useRouter();
  const [action, setAction] = useState(initial);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const { preview } = action;

  function apply() {
    if (preview.danger && !confirming) {
      setConfirming(true);
      return;
    }
    start(async () => {
      setAction(await applyAssistantAction(action.id));
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-accent/40 bg-surface p-3 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="fl-ai-badge flex h-6 w-6 flex-none items-center justify-center rounded-lg text-xs text-white" aria-hidden="true">
          ✦
        </span>
        {preview.title}
      </p>
      <dl className="space-y-1 text-xs">
        {preview.lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <dt className="w-24 flex-none text-ink-faint">{l.label}</dt>
            <dd className="min-w-0 flex-1 break-words text-ink">{l.value}</dd>
          </div>
        ))}
      </dl>
      {preview.body && (
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background/70 p-2.5 font-sans text-xs leading-relaxed text-ink">
          {preview.body}
        </pre>
      )}
      {action.status === "pending" || action.status === "applying" ? (
        <div className="space-y-2">
          {action.result && <p className="text-xs text-error">{action.result}</p>}
          {confirming && preview.danger && <p className="text-xs font-semibold text-[var(--status-warn)]">⚠️ {preview.danger} ¿Seguro?</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || action.status === "applying"}
              onClick={apply}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
            >
              {pending || action.status === "applying" ? "Aplicando…" : confirming ? "Sí, aplicar" : "Aplicar"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => (confirming ? setConfirming(false) : start(async () => setAction(await discardAssistantAction(action.id))))}
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink-muted transition hover:text-ink disabled:opacity-60"
            >
              {confirming ? "Cancelar" : "Descartar"}
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
            action.status === "applied" ? "bg-[#0ca30c]/12 text-[var(--status-good)]" : action.status === "failed" ? "bg-error/10 text-error" : "bg-surface-2 text-ink-muted"
          }`}
        >
          {action.status === "applied" ? `✓ ${action.result}` : action.status === "discarded" ? "Descartado" : action.result}
        </p>
      )}
    </div>
  );
}

// ---- Chat ----

const THINKING = ["Revisando tu cuenta…", "Leyendo la información…", "Preparando la respuesta…"];

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % THINKING.length), 2500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted" role="status">
      <span className="fl-ai-badge h-2 w-2 animate-ping rounded-full" />
      {THINKING[i]}
    </div>
  );
}

function Item({ item }: { item: ChatItem }) {
  if (item.type === "user")
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-accent-ink">{item.text}</p>
      </div>
    );
  if (item.type === "assistant")
    return (
      <div className="max-w-[92%] break-words text-sm leading-relaxed text-ink">
        <Markdown text={item.text} />
      </div>
    );
  if (item.type === "step") return <p className="text-xs text-ink-faint">🔎 {item.label}</p>;
  return <ActionCard action={item.action} />;
}

export function AssistantChat() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ChatView | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<{ id: string; title: string }[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { businessId, pageLabel } = pageContext(pathname);

  const loadThread = useCallback((id: string) => {
    start(async () => {
      const v = await getAssistantThread(id).catch(() => null);
      setView(v);
      write(THREAD_KEY, v ? v.threadId : null);
    });
  }, []);

  const send = useCallback(
    (raw: string) => {
      const body = raw.trim();
      if (!body || pending) return;
      setError(null);
      setText("");
      setHistory(null);
      // Show the question right away while the assistant works.
      setView((v) => ({ threadId: v?.threadId ?? "", title: v?.title ?? body, items: [...(v?.items ?? []), { type: "user", text: body }] }));
      start(async () => {
        const res = await sendAssistantMessage({ threadId: view?.threadId || null, text: body, businessId, pageLabel }).catch(() => ({
          ok: false as const,
          error: "No hubo conexión. Intenta de nuevo.",
          view: undefined,
        }));
        if (res.view) {
          setView(res.view);
          write(THREAD_KEY, res.view.threadId);
        }
        if (!res.ok) setError(res.error);
      });
    },
    [businessId, pageLabel, pending, view?.threadId],
  );

  // Open from anywhere (e.g. the agent's prompt editor), optionally with a question.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const preset = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (preset) setText(preset);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
  }, []);

  // Pick up the last conversation the first time it opens.
  useEffect(() => {
    if (!open || view) return;
    const saved = read(THREAD_KEY);
    if (saved) loadThread(saved);
  }, [open, view, loadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [view?.items.length, pending, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On a phone, an open WhatsApp/Messenger chat owns the bottom of the screen.
  const chatOpenOnPhone = !!searchParams.get("conv") || (pathname.includes("/redes/mensajes") && !!searchParams.get("c"));

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          aria-label="Abrir el Asistente Funnels"
          className={`fl-raised fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-40 items-center gap-2 rounded-full bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-lg transition hover:-translate-y-0.5 md:bottom-6 md:right-6 ${
            chatOpenOnPhone ? "hidden md:flex" : "flex"
          }`}
        >
          <span className="fl-ai-badge flex h-7 w-7 items-center justify-center rounded-full text-sm text-white" aria-hidden="true">
            ✦
          </span>
          Asistente
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Asistente Funnels"
          className="fixed inset-0 z-50 flex flex-col bg-surface pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] md:inset-auto md:bottom-6 md:right-6 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[26rem] md:rounded-3xl md:border md:border-border md:pb-0 md:pt-0 md:shadow-2xl"
        >
          <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <span className="fl-ai-badge flex h-9 w-9 flex-none items-center justify-center rounded-xl text-white" aria-hidden="true">
              ✦
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-ink">Asistente Funnels</p>
              <p className="truncate text-xs text-ink-muted">{pageLabel ? `Estás en ${pageLabel}` : "Pídeme lo que necesites de la plataforma"}</p>
            </div>
            <button
              type="button"
              title="Conversaciones anteriores"
              aria-label="Conversaciones anteriores"
              onClick={() => (history ? setHistory(null) : listAssistantThreads().then(setHistory).catch(() => setHistory([])))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5M12 7v5l3 2" />
              </svg>
            </button>
            <button
              type="button"
              title="Nueva conversación"
              aria-label="Nueva conversación"
              onClick={() => {
                setView(null);
                setHistory(null);
                setError(null);
                write(THREAD_KEY, null);
                inputRef.current?.focus();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Cerrar el asistente"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-ink-muted transition hover:bg-surface-2 hover:text-ink"
            >
              ×
            </button>
          </header>

          {history && (
            <div className="max-h-64 overflow-y-auto border-b border-border bg-surface-2/50 p-2">
              {history.length === 0 && <p className="p-2 text-sm text-ink-muted">Aún no tienes conversaciones guardadas.</p>}
              {history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setHistory(null);
                    loadThread(h.id);
                  }}
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-surface"
                >
                  {h.title}
                </button>
              ))}
            </div>
          )}

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!view?.items.length && !pending && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-ink">¿Qué hacemos hoy?</p>
                  <p className="text-sm text-ink-muted">
                    Pídeme cosas en tus palabras: escribo el prompt de tu agente, creo plantillas y respuestas automáticas, cargo productos, edito tu página o reviso tus
                    métricas. Antes de cambiar algo te muestro la propuesta para que la apliques.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-left text-sm text-ink transition hover:border-accent/50 hover:bg-accent/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {view?.items.map((item, i) => (
              <Item key={item.type === "action" ? item.action.id : `${i}-${item.type}`} item={item} />
            ))}
            {pending && <Thinking />}
            {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-end gap-2 border-t border-border p-3"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Escribe tu mensaje al asistente
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Escribe lo que necesitas"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none md:text-sm"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label="Enviar"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}
