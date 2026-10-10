import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { MetaApiError } from "@/lib/metaSocial";
import { REPLY_WINDOW_MS, isMissingPermission, listThreads, threadMessages, type InboxMessage, type InboxNetwork, type InboxThread } from "@/lib/metaInbox";
import { RedesTabs } from "../RedesTabs";
import { FacebookGlyph, InstagramGlyph } from "../icons";
import { shortDateTime } from "../format";
import { InboxPoller, ReplyBox, ResolveButton, ScrollToBottom } from "./inboxControls";

// Messenger + Instagram Direct for the connected Page, answered by people on
// the team. Read live from Meta on every visit (and every 20 s while open);
// only read/resolved state is stored here.

const FILTERS = [
  { key: "pendientes", label: "Sin resolver" },
  { key: "sin-leer", label: "Sin leer" },
  { key: "todos", label: "Todos" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const NETWORK_STYLE: Record<InboxNetwork, { label: string; color: string; glyph: React.ReactNode; tile: string }> = {
  facebook: { label: "Messenger", color: "var(--series-fb)", glyph: <FacebookGlyph />, tile: "linear-gradient(135deg, #1877f2, #0b55c4)" },
  instagram: { label: "Instagram", color: "var(--series-ig)", glyph: <InstagramGlyph />, tile: "linear-gradient(135deg, #f58529, #dd2a7b 55%, #8134af)" },
};

type Row = InboxThread & { unread: boolean; resolved: boolean };

const nowMs = () => Date.now();

function listTime(iso: string, now: number): string {
  const diff = now - Date.parse(iso);
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return shortDateTime(iso).split(",")[0];
}

const initials = (name: string) =>
  name
    .replace(/^@/, "")
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function Avatar({ name, network, size = "md" }: { name: string; network: InboxNetwork; size?: "md" | "lg" }) {
  const n = NETWORK_STYLE[network];
  return (
    <span className={`relative flex-none ${size === "lg" ? "h-11 w-11" : "h-10 w-10"}`}>
      <span className="fl-mono flex h-full w-full items-center justify-center rounded-full border border-border bg-surface-2 text-[13px] font-bold text-ink-muted">{initials(name)}</span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ring-2 ring-surface [&_svg]:h-2.5 [&_svg]:w-2.5" style={{ background: n.tile }}>
        {n.glyph}
      </span>
    </span>
  );
}

function MessageBubble({ m }: { m: InboxMessage }) {
  return (
    <div className={`flex ${m.fromCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`min-w-0 max-w-[85%] space-y-1.5 rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm md:max-w-[70%] ${
          m.fromCustomer ? "border border-border bg-surface" : "border border-accent-secondary/30 bg-accent-secondary/10"
        }`}
      >
        {m.storyNote && <p className="text-xs italic text-ink-muted">{m.storyNote}</p>}
        {m.attachments.map((a, i) =>
          a.kind === "image" ? (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt="Imagen enviada" className="max-h-64 rounded-xl object-cover" loading="lazy" />
            </a>
          ) : a.kind === "video" ? (
            <video key={i} src={a.url} controls className="max-h-64 rounded-xl" />
          ) : a.kind === "audio" ? (
            <audio key={i} src={a.url} controls className="max-w-full" />
          ) : (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block text-accent underline">
              📎 {a.name ?? "Archivo adjunto"}
            </a>
          ),
        )}
        {m.text && <p className="whitespace-pre-wrap break-words text-ink">{m.text}</p>}
        {!m.text && m.attachments.length === 0 && !m.storyNote && <p className="text-xs italic text-ink-muted">Mensaje que Meta no deja mostrar aquí</p>}
        <p className="text-right text-[11px] text-ink-faint">{shortDateTime(m.createdAt)}</p>
      </div>
    </div>
  );
}

export default async function MensajesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string; f?: string; red?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === sp.f) ? (sp.f as FilterKey) : "pendientes";
  const networkFilter: InboxNetwork | "todas" = sp.red === "facebook" || sp.red === "instagram" ? sp.red : "todas";
  const query = (sp.q ?? "").trim().toLowerCase();

  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, socialConnection: true } } },
  });
  if (!membership) notFound();
  const { business } = membership;
  const connection = business.socialConnection;
  const canManage = membership.role !== "MEMBER";

  const header = (
    <header className="space-y-4">
      <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
        ← {business.name}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Redes sociales</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">Los mensajes de Messenger e Instagram, para que tu equipo los responda desde aquí.</p>
        </div>
        <RedesTabs businessId={id} active="mensajes" />
      </div>
    </header>
  );

  if (!connection?.fbPageId || !connection.pageAccessToken) {
    return (
      <div className="min-w-0 space-y-8">
        {header}
        <section className="fl-card-hero space-y-3 p-6">
          <h2 className="text-lg font-semibold">Conecta tu página de Facebook</h2>
          <p className="text-sm text-ink-muted">Para ver y responder los mensajes de Messenger e Instagram, primero conecta tus redes en la pestaña Métricas.</p>
          <Link href={`/dashboard/businesses/${id}/redes`} className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
            Ir a conectar
          </Link>
        </section>
      </div>
    );
  }

  const pageId = connection.fbPageId;
  const igUserId = connection.igUserId;
  const pageToken = decryptSecret(connection.pageAccessToken);
  const networks: InboxNetwork[] = igUserId ? ["facebook", "instagram"] : ["facebook"];

  let missingPermission = false;
  let needsReconnect = false;
  const errors: string[] = [];
  const fetched = await Promise.all(
    networks.map((network) =>
      listThreads({ pageId, igUserId, pageToken, network }).catch((err) => {
        if (err instanceof MetaApiError && err.needsReconnect) needsReconnect = true;
        else if (isMissingPermission(err)) missingPermission = true;
        else errors.push(`${NETWORK_STYLE[network].label}: ${err instanceof Error ? err.message : "error"}`);
        console.error(`[social inbox] ${network} threads failed`, err);
        return [] as InboxThread[];
      }),
    ),
  );
  const threads = fetched.flat();
  const states = await prisma.socialThreadState.findMany({ where: { businessId: id, conversationId: { in: threads.map((t) => t.id) } } });
  const stateById = new Map(states.map((s) => [s.conversationId, s]));

  const rows: Row[] = threads
    .map((t) => {
      const s = stateById.get(t.id);
      const updated = Date.parse(t.updatedAt);
      // A new message from the customer reopens a resolved thread.
      const resolved = !!s?.resolvedAt && !(t.lastFromCustomer && updated > s.resolvedAt.getTime());
      const unread = t.lastFromCustomer && (!s?.readAt || updated > s.readAt.getTime());
      return { ...t, unread, resolved };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const visible = rows.filter(
    (r) =>
      (networkFilter === "todas" || r.network === networkFilter) &&
      (filter === "todos" || (filter === "pendientes" ? !r.resolved : r.unread)) &&
      (!query || r.customerName.toLowerCase().includes(query) || r.snippet.toLowerCase().includes(query)),
  );
  const counts = { pendientes: rows.filter((r) => !r.resolved).length, "sin-leer": rows.filter((r) => r.unread).length, todos: rows.length };

  const selected = sp.c ? rows.find((r) => r.id === sp.c) ?? null : null;
  let messages: InboxMessage[] = [];
  let threadError: string | null = null;
  if (selected) {
    try {
      messages = await threadMessages({ conversationId: selected.id, pageId, igUserId, pageToken });
    } catch (err) {
      threadError = err instanceof Error ? err.message : "Meta no devolvió los mensajes";
    }
    if (selected.unread) {
      await prisma.socialThreadState.upsert({
        where: { businessId_conversationId: { businessId: id, conversationId: selected.id } },
        create: { businessId: id, conversationId: selected.id, network: selected.network, readAt: new Date() },
        update: { readAt: new Date() },
      });
    }
  }
  const lastCustomerAt = [...messages].reverse().find((m) => m.fromCustomer)?.createdAt ?? selected?.lastCustomerAt ?? null;
  const now = nowMs();
  const windowOpen = !!lastCustomerAt && now - Date.parse(lastCustomerAt) < REPLY_WINDOW_MS;

  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { f: filter, red: networkFilter, q: sp.q ?? "", c: sp.c ?? "", ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "f" && v === "pendientes") && !(k === "red" && v === "todas")) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="min-w-0 space-y-6">
      {header}
      <InboxPoller />

      {(missingPermission || needsReconnect) && (
        <section className="fl-card-hero space-y-3 p-5">
          <h2 className="text-base font-semibold">{needsReconnect ? "Tu conexión con Facebook venció" : "Falta dar permiso para leer tus mensajes"}</h2>
          <p className="text-sm text-ink-muted">
            {needsReconnect
              ? "Meta pide volver a iniciar sesión cada cierto tiempo. Reconecta y tus mensajes vuelven a aparecer."
              : "Conectaste tus redes antes de que existiera la bandeja de mensajes. Vuelve a conectar Facebook y acepta los permisos de mensajes de Messenger e Instagram."}
          </p>
          {canManage ? (
            <a href={`/api/social/meta/connect?businessId=${id}`} className="inline-block rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#1877f2" }}>
              Reconectar con Facebook
            </a>
          ) : (
            <p className="text-sm text-ink-muted">Pídele al dueño del negocio que reconecte Facebook.</p>
          )}
        </section>
      )}
      {errors.length > 0 && (
        <p className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-muted">Meta no devolvió algunos mensajes ahora: {errors.join(" · ")}</p>
      )}

      <div className="grid min-h-[70vh] overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-[minmax(17rem,22rem)_1fr]">
        {/* Thread list (hidden on phones while a conversation is open). */}
        <aside className={`min-w-0 flex-col border-border md:flex md:border-r ${selected ? "hidden" : "flex"}`}>
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex items-center gap-1.5">
              {(["todas", ...networks] as const).map((n) => (
                <Link
                  key={n}
                  href={href({ red: n, c: null })}
                  aria-current={networkFilter === n ? "true" : undefined}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    networkFilter === n ? "border-accent/50 bg-accent/10 text-ink" : "border-border text-ink-muted hover:text-ink"
                  }`}
                >
                  {n === "todas" ? (
                    "Todas"
                  ) : (
                    <>
                      <span className="flex h-4 w-4 items-center justify-center rounded text-white [&_svg]:h-2.5 [&_svg]:w-2.5" style={{ background: NETWORK_STYLE[n].tile }}>
                        {NETWORK_STYLE[n].glyph}
                      </span>
                      {NETWORK_STYLE[n].label}
                    </>
                  )}
                </Link>
              ))}
            </div>
            <form className="flex gap-2" action="">
              {filter !== "pendientes" && <input type="hidden" name="f" value={filter} />}
              {networkFilter !== "todas" && <input type="hidden" name="red" value={networkFilter} />}
              <label htmlFor="inbox-search" className="sr-only">
                Buscar
              </label>
              <input
                id="inbox-search"
                name="q"
                type="search"
                defaultValue={sp.q ?? ""}
                placeholder="Buscar por nombre o mensaje"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
            </form>
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={href({ f: f.key, c: null })}
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold transition ${
                    filter === f.key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {f.label}
                  <span className="font-normal text-ink-muted">{counts[f.key]}</span>
                </Link>
              ))}
            </div>
          </div>
          <ul className="max-h-[65vh] flex-1 divide-y divide-border overflow-y-auto">
            {visible.map((r) => (
              <li key={r.id}>
                <Link
                  href={href({ c: r.id })}
                  className={`flex gap-3 px-3 py-3 transition hover:bg-surface-2/70 ${selected?.id === r.id ? "bg-accent/10" : ""}`}
                >
                  <Avatar name={r.customerName} network={r.network} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm ${r.unread ? "font-bold text-ink" : "font-medium text-ink"}`}>{r.customerName}</p>
                      <span className="flex-none text-[11px] text-ink-faint">{listTime(r.updatedAt, now)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-xs ${r.unread ? "font-semibold text-ink" : "text-ink-muted"}`}>
                        {r.lastFromCustomer ? "" : "Tú: "}
                        {r.snippet || "Archivo o foto"}
                      </p>
                      {r.unread && <span className="ml-auto h-2.5 w-2.5 flex-none rounded-full bg-accent" aria-label="Sin leer" />}
                      {r.resolved && <span className="ml-auto flex-none text-[11px] text-ink-faint">✓ Resuelta</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-ink-muted">
                {rows.length === 0 ? "Todavía no hay mensajes de Messenger ni Instagram." : filter === "pendientes" ? "¡Todo al día! No hay conversaciones sin resolver." : "Nada por aquí con estos filtros."}
              </li>
            )}
          </ul>
        </aside>

        {/* Open conversation. */}
        <section className={`min-w-0 flex-col md:flex ${selected ? "flex" : "hidden"}`}>
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href={href({ c: null })} className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface-2 hover:text-ink md:hidden" aria-label="Volver a la lista">
                    ←
                  </Link>
                  <Avatar name={selected.customerName} network={selected.network} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{selected.customerName}</p>
                    <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: NETWORK_STYLE[selected.network].color }} />
                      {NETWORK_STYLE[selected.network].label}
                    </p>
                  </div>
                </div>
                <ResolveButton
                  businessId={id}
                  thread={{ conversationId: selected.id, network: selected.network, recipientId: selected.customerId }}
                  resolved={selected.resolved}
                />
              </div>
              <div className="max-h-[55vh] flex-1 space-y-2.5 overflow-y-auto bg-background/40 p-4">
                {threadError ? (
                  <p className="text-sm text-ink-muted">Meta no devolvió los mensajes: {threadError}</p>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} m={m} />)
                )}
                <ScrollToBottom dep={`${selected.id}:${messages.length}`} />
              </div>
              <div className="border-t border-border p-3">
                <ReplyBox
                  key={selected.id}
                  businessId={id}
                  thread={{ conversationId: selected.id, network: selected.network, recipientId: selected.customerId }}
                  windowOpen={windowOpen}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
              <span className="text-4xl" aria-hidden="true">
                💬
              </span>
              <p className="font-semibold text-ink">Elige una conversación</p>
              <p className="max-w-xs text-sm text-ink-muted">Los mensajes nuevos aparecen solos. Estos los responde tu equipo; el agente de IA solo atiende WhatsApp.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
