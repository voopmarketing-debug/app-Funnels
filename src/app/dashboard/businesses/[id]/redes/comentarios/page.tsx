import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { MetaApiError, friendlyMetaError } from "@/lib/metaSocial";
import { isMissingPermission } from "@/lib/metaInbox";
import { PRIVATE_REPLY_WINDOW_MS, facebookComments, instagramComments, type CommentNetwork, type SocialComment } from "@/lib/metaComments";
import { RedesTabs } from "../RedesTabs";
import { FacebookGlyph, InstagramGlyph } from "../icons";
import { shortDateTime } from "../format";
import { InboxPoller } from "../mensajes/inboxControls";
import { sweepCommentAutoReplies } from "@/lib/commentAutoReply";
import { CommentActions } from "./commentControls";

// Comments on the latest Facebook posts and Instagram publications, read live
// from Meta and answered by people on the team. Only "Listo" is stored here.

const FILTERS = [
  { key: "pendientes", label: "Sin responder" },
  { key: "todos", label: "Todos" },
  { key: "ocultos", label: "Ocultos" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const NETWORK_STYLE: Record<CommentNetwork, { label: string; glyph: React.ReactNode; tile: string }> = {
  facebook: { label: "Facebook", glyph: <FacebookGlyph />, tile: "linear-gradient(135deg, #1877f2, #0b55c4)" },
  instagram: { label: "Instagram", glyph: <InstagramGlyph />, tile: "linear-gradient(135deg, #f58529, #dd2a7b 55%, #8134af)" },
};

type Row = SocialComment & { done: boolean };

const nowMs = () => Date.now();

const initials = (name: string) =>
  name
    .replace(/^@/, "")
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function ago(iso: string, now: number): string {
  const diff = now - Date.parse(iso);
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return shortDateTime(iso).split(",")[0];
}

function NetworkBadge({ network }: { network: CommentNetwork }) {
  const n = NETWORK_STYLE[network];
  return (
    <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-white [&_svg]:h-2.5 [&_svg]:w-2.5" style={{ background: n.tile }}>
      {n.glyph}
    </span>
  );
}

export default async function ComentariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string; red?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === sp.f) ? (sp.f as FilterKey) : "pendientes";
  const networkFilter: CommentNetwork | "todas" = sp.red === "facebook" || sp.red === "instagram" ? sp.red : "todas";
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
          <p className="mt-1 max-w-xl text-sm text-ink-muted">Los comentarios de tus publicaciones de Facebook e Instagram, para responderlos u ocultarlos desde aquí.</p>
        </div>
        <RedesTabs businessId={id} active="comentarios" />
      </div>
    </header>
  );

  if (!connection?.fbPageId || !connection.pageAccessToken) {
    return (
      <div className="min-w-0 space-y-8">
        {header}
        <section className="fl-card-hero space-y-3 p-6">
          <h2 className="text-lg font-semibold">Conecta tu página de Facebook</h2>
          <p className="text-sm text-ink-muted">Para ver y responder comentarios, primero conecta tus redes en la pestaña Métricas.</p>
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
  const networks: CommentNetwork[] = igUserId ? ["facebook", "instagram"] : ["facebook"];

  let missingPermission = false;
  let needsReconnect = false;
  const errors: string[] = [];
  const fetched = await Promise.all(
    networks.map((network) =>
      (network === "facebook" ? facebookComments(pageId, pageToken) : instagramComments(igUserId!, pageToken)).catch((err) => {
        if (err instanceof MetaApiError && err.needsReconnect) needsReconnect = true;
        else if (isMissingPermission(err)) missingPermission = true;
        else errors.push(`${NETWORK_STYLE[network].label}: ${friendlyMetaError(err)}`);
        console.error(`[social comments] ${network} failed`, err);
        return [] as SocialComment[];
      }),
    ),
  );
  const comments = fetched.flat();
  // Opening Comentarios also checks the keyword rules (throttled), so an
  // auto-reply Meta's webhook missed doesn't wait for the 10-minute job.
  after(() => sweepCommentAutoReplies({ businessIds: [id] }).catch((err) => console.error("[social comments] sweep failed", err)));
  const activeRules = await prisma.commentAutoReply.count({ where: { businessId: id, enabled: true } });
  const states = await prisma.socialThreadState.findMany({
    where: { businessId: id, conversationId: { in: comments.map((c) => c.id) }, resolvedAt: { not: null } },
    select: { conversationId: true },
  });
  const doneIds = new Set(states.map((s) => s.conversationId));

  const rows: Row[] = comments
    .map((c) => ({ ...c, done: c.answered || doneIds.has(c.id) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const inNetwork = rows.filter((r) => networkFilter === "todas" || r.network === networkFilter);
  const counts = {
    pendientes: inNetwork.filter((r) => !r.done && !r.hidden).length,
    todos: inNetwork.length,
    ocultos: inNetwork.filter((r) => r.hidden).length,
  };
  const visible = inNetwork.filter(
    (r) =>
      (filter === "todos" || (filter === "ocultos" ? r.hidden : !r.done && !r.hidden)) &&
      (!query || r.authorName.toLowerCase().includes(query) || r.text.toLowerCase().includes(query) || r.post.text.toLowerCase().includes(query)),
  );
  const now = nowMs();

  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { f: filter, red: networkFilter, q: sp.q ?? "", ...over };
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
          <h2 className="text-base font-semibold">{needsReconnect ? "Tu conexión con Facebook venció" : "Falta dar permiso para leer tus comentarios"}</h2>
          <p className="text-sm text-ink-muted">
            {needsReconnect
              ? "Meta pide volver a iniciar sesión cada cierto tiempo. Reconecta y tus comentarios vuelven a aparecer."
              : "Conectaste tus redes antes de que existiera esta sección. Vuelve a conectar Facebook y acepta los permisos de comentarios de Facebook e Instagram."}
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
        <p className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-muted">Meta no devolvió algunos comentarios ahora: {errors.join(" · ")}</p>
      )}

      <Link
        href={`/dashboard/businesses/${id}/redes/comentarios/automaticas`}
        className="fl-card flex items-center gap-3 p-4 transition hover:border-accent/50"
      >
        <span className="fl-ai-badge flex h-10 w-10 flex-none items-center justify-center rounded-xl text-lg text-white" aria-hidden="true">
          ⚡
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Respuestas automáticas por palabra clave</span>
          <span className="block text-sm text-ink-muted">
            {activeRules > 0
              ? `${activeRules} regla${activeRules === 1 ? " activa" : "s activas"}: cuando alguien comenta la palabra, se responde solo.`
              : "Ej. «Comenta INFO»: la plataforma responde el comentario y le escribe por privado, sola."}
          </span>
        </span>
        <span className="flex-none text-sm font-semibold text-accent">{activeRules > 0 ? "Ver reglas →" : "Crear regla →"}</span>
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filtrar comentarios" className="fl-seg">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href({ f: f.key })} role="tab" aria-selected={filter === f.key} className="fl-seg-item px-3 text-sm">
              {f.label}
              <span className="text-xs font-normal opacity-75">{counts[f.key]}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["todas", ...networks] as const).map((n) => (
            <Link key={n} href={href({ red: n })} aria-current={networkFilter === n ? "true" : undefined} className="fl-chip flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
              {n === "todas" ? "Todas" : <><NetworkBadge network={n} />{NETWORK_STYLE[n].label}</>}
            </Link>
          ))}
          <form action="" className="min-w-0 flex-1 sm:flex-none">
            {filter !== "pendientes" && <input type="hidden" name="f" value={filter} />}
            {networkFilter !== "todas" && <input type="hidden" name="red" value={networkFilter} />}
            <label htmlFor="comments-search" className="sr-only">
              Buscar comentarios
            </label>
            <input
              id="comments-search"
              name="q"
              type="search"
              defaultValue={sp.q ?? ""}
              placeholder="Buscar por nombre o texto"
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none sm:w-56"
            />
          </form>
        </div>
      </div>

      <ul className="space-y-3">
        {visible.map((c) => (
          <li key={c.id} className={`fl-card space-y-3 p-4 ${c.hidden ? "opacity-75" : ""}`}>
            <div className="flex gap-3">
              <span className="relative h-10 w-10 flex-none">
                <span className="fl-mono flex h-full w-full items-center justify-center rounded-full border border-border bg-surface-2 text-[13px] font-bold text-ink-muted">{initials(c.authorName)}</span>
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface">
                  <NetworkBadge network={c.network} />
                </span>
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="font-semibold text-ink">{c.authorName}</p>
                  <span className="text-xs text-ink-faint">{ago(c.createdAt, now)}</span>
                  {c.likeCount > 0 && <span className="text-xs text-ink-faint">♥ {c.likeCount}</span>}
                  {c.hidden && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">🙈 Oculto</span>}
                  {c.answered ? (
                    <span className="rounded-full bg-[#0ca30c]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--status-good)]">✓ Respondido</span>
                  ) : c.done ? (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">✓ Listo</span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{c.text || <span className="italic text-ink-muted">Comentario con foto o sticker</span>}</p>
              </div>
            </div>

            {c.replies.length > 0 && (
              <ul className="ml-[3.25rem] space-y-1.5 border-l-2 border-border pl-3">
                {c.replies.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className={`font-semibold ${r.fromUs ? "text-accent" : "text-ink"}`}>{r.authorName}</span>{" "}
                    <span className="text-ink-muted">{r.text}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="ml-[3.25rem] space-y-3">
              <a
                href={c.post.permalink ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex max-w-xl items-center gap-2.5 rounded-xl border border-border bg-surface-2/50 p-2 transition hover:border-border-strong"
              >
                {c.post.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.post.image} alt="" className="h-10 w-10 flex-none rounded-lg object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-surface text-lg" aria-hidden="true">
                    📝
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">En tu publicación de {NETWORK_STYLE[c.network].label}</span>
                  <span className="block truncate text-xs text-ink-muted">{c.post.text || "Publicación sin texto"}</span>
                </span>
                <span className="ml-auto flex-none text-xs text-ink-faint" aria-hidden="true">
                  ↗
                </span>
              </a>
              <CommentActions
                businessId={id}
                comment={{ id: c.id, network: c.network }}
                hidden={c.hidden}
                done={c.done}
                canPrivate={now - Date.parse(c.createdAt) < PRIVATE_REPLY_WINDOW_MS}
                authorName={c.authorName}
              />
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="fl-card px-4 py-12 text-center">
            <p className="text-3xl" aria-hidden="true">
              {filter === "pendientes" && rows.length > 0 ? "🎉" : "💬"}
            </p>
            <p className="mt-2 font-semibold text-ink">
              {rows.length === 0
                ? "Todavía no hay comentarios en tus últimas publicaciones."
                : filter === "pendientes"
                  ? "¡Todo al día! No hay comentarios sin responder."
                  : "Nada por aquí con estos filtros."}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Revisamos los comentarios de tus últimas 12 publicaciones en cada red. Los nuevos aparecen solos.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
