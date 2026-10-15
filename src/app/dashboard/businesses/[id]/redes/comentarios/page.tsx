import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { MetaApiError, friendlyMetaError } from "@/lib/metaSocial";
import { isMissingPermission } from "@/lib/metaInbox";
import { PRIVATE_REPLY_WINDOW_MS, adComments, facebookComments, instagramComments, mergeComments, missingCommentPermissions, type CommentNetwork, type SocialComment } from "@/lib/metaComments";
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
  searchParams: Promise<{ f?: string; red?: string; q?: string; tipo?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === sp.f) ? (sp.f as FilterKey) : "pendientes";
  const networkFilter: CommentNetwork | "todas" = sp.red === "facebook" || sp.red === "instagram" ? sp.red : "todas";
  const query = (sp.q ?? "").trim().toLowerCase();
  // Organic posts, ads (their comments live on separate, often hidden, posts) or both.
  const typeFilter: "todo" | "publicaciones" | "anuncios" = sp.tipo === "publicaciones" || sp.tipo === "anuncios" ? sp.tipo : "todo";

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
  // Ad comments need the ad account (user token with ads_read); a failure there never hides the rest.
  let adsUnavailable = false;
  const adStats = { unreadable: 0 };
  const hasAds = !!connection.adAccountId && !!connection.userAccessToken;
  const ads = hasAds
    ? await adComments({
        adAccountId: connection.adAccountId!,
        userToken: decryptSecret(connection.userAccessToken!),
        pageId,
        igUserId,
        pageToken,
        stats: adStats,
      }).catch((err) => {
        if (err instanceof MetaApiError && err.needsReconnect) needsReconnect = true;
        else adsUnavailable = true;
        console.error("[social comments] ads failed", err);
        return [] as SocialComment[];
      })
    : [];
  const comments = mergeComments(fetched.flat(), ads);
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
  const inNetwork = rows.filter(
    (r) =>
      (networkFilter === "todas" || r.network === networkFilter) &&
      (typeFilter === "todo" || (typeFilter === "anuncios" ? !!r.ad : !r.ad)),
  );
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

  // Meta leaves out who wrote a comment when the login lacks "read comments" (or the app isn't
  // approved for it): say which one it is instead of showing a nameless list.
  const nameless = rows.filter((r) => !r.authorKnown).length;
  const missingPermissions = nameless > 0 && connection.userAccessToken ? await missingCommentPermissions(decryptSecret(connection.userAccessToken)) : null;

  // One card per publication with its comments underneath (not the same post repeated on every comment).
  const pendingByPost = new Map<string, number>();
  for (const r of inNetwork) if (!r.done && !r.hidden) pendingByPost.set(`${r.network}:${r.post.id}`, (pendingByPost.get(`${r.network}:${r.post.id}`) ?? 0) + 1);
  const groups = new Map<string, { key: string; first: Row; comments: Row[] }>();
  for (const r of visible) {
    const key = `${r.network}:${r.post.id}`;
    const g = groups.get(key);
    if (g) g.comments.push(r);
    else groups.set(key, { key, first: r, comments: [r] });
  }
  // `visible` is newest first, so each group's first comment is its newest and groups come out newest first.
  const groupList = [...groups.values()];
  const SHOWN_PER_POST = 5;

  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { f: filter, red: networkFilter, tipo: typeFilter, q: sp.q ?? "", ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "f" && v === "pendientes") && !(k === "red" && v === "todas") && !(k === "tipo" && v === "todo")) p.set(k, v);
    }
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
      {nameless > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4 text-sm">
          <p className="font-semibold text-ink">Meta no nos dio el nombre de {nameless === 1 ? "1 persona" : `${nameless} personas`} que comentaron</p>
          <p className="mt-1 text-ink-muted">
            {missingPermissions?.includes("pages_read_user_content")
              ? "Tu conexión no tiene el permiso para leer quién comenta (pages_read_user_content). Reconecta Facebook y acepta todos los permisos: los nombres aparecen solos. El comentario y las respuestas funcionan igual."
              : "Aunque la conexión tiene el permiso, Meta solo entrega los nombres de quienes comentan cuando la app tiene aprobado el acceso avanzado (la revisión de Meta). Mientras tanto ves lo que escribieron, pero no quiénes son; responder y ocultar funcionan igual."}
          </p>
          {missingPermissions?.includes("pages_read_user_content") && canManage && (
            <a href={`/api/social/meta/connect?businessId=${id}`} className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "#1877f2" }}>
              Reconectar con Facebook
            </a>
          )}
        </section>
      )}
      {adStats.unreadable > 0 && (
        <p className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-muted">
          Meta no dejó leer los comentarios de {adStats.unreadable === 1 ? "1 publicación de tus anuncios" : `${adStats.unreadable} publicaciones de tus anuncios`} (suele pasar con anuncios de Instagram o ya
          eliminados). Los demás se muestran completos.
        </p>
      )}
      {adsUnavailable && (
        <p className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-muted">
          No pudimos leer los comentarios de tus anuncios ahora. Si sigue pasando, reconecta Facebook en Métricas y acepta el permiso de anuncios.
        </p>
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Filtrar comentarios" className="fl-seg">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href({ f: f.key })} role="tab" aria-selected={filter === f.key} className="fl-seg-item px-3 text-sm">
              {f.label}
              <span className="text-xs font-normal opacity-75">{counts[f.key]}</span>
            </Link>
          ))}
        </div>
        {hasAds && (
          <div role="tablist" aria-label="Publicaciones o anuncios" className="fl-seg">
            {(
              [
                ["todo", "Todo"],
                ["publicaciones", "Publicaciones"],
                ["anuncios", "📣 Anuncios"],
              ] as const
            ).map(([key, label]) => (
              <Link key={key} href={href({ tipo: key })} role="tab" aria-selected={typeFilter === key} className="fl-seg-item px-3 text-sm">
                {label}
              </Link>
            ))}
          </div>
        )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["todas", ...networks] as const).map((n) => (
            <Link key={n} href={href({ red: n })} aria-current={networkFilter === n ? "true" : undefined} className="fl-chip flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
              {n === "todas" ? "Todas las redes" : <><NetworkBadge network={n} />{NETWORK_STYLE[n].label}</>}
            </Link>
          ))}
          <form action="" className="min-w-0 flex-1 sm:flex-none">
            {filter !== "pendientes" && <input type="hidden" name="f" value={filter} />}
            {networkFilter !== "todas" && <input type="hidden" name="red" value={networkFilter} />}
            {typeFilter !== "todo" && <input type="hidden" name="tipo" value={typeFilter} />}
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

      <ul className="space-y-4">
        {groupList.map((g) => {
          const post = g.first.post;
          const ad = g.first.ad;
          const network = g.first.network;
          const pending = pendingByPost.get(g.key) ?? 0;
          const shown = g.comments.slice(0, SHOWN_PER_POST);
          const rest = g.comments.slice(SHOWN_PER_POST);
          const renderComment = (c: Row) => (
            <li key={c.id} className={`space-y-3 p-4 ${c.hidden ? "opacity-75" : ""}`}>
              <div className="flex gap-3">
                <span className="relative h-10 w-10 flex-none">
                  <span className="fl-mono flex h-full w-full items-center justify-center rounded-full border border-border bg-surface-2 text-[13px] font-bold text-ink-muted">
                    {c.authorKnown ? initials(c.authorName) : "?"}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface">
                    <NetworkBadge network={c.network} />
                  </span>
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className={`font-semibold ${c.authorKnown ? "text-ink" : "text-ink-muted"}`} title={c.authorKnown ? undefined : "Meta no entregó el nombre de esta persona"}>
                      {c.authorKnown ? c.authorName : "Nombre no disponible"}
                    </p>
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
                      <span className={`font-semibold ${r.fromUs ? "text-accent" : "text-ink"}`}>{r.authorName}</span> <span className="text-ink-muted">{r.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="ml-[3.25rem]">
                <CommentActions
                  businessId={id}
                  comment={{ id: c.id, network: c.network }}
                  hidden={c.hidden}
                  done={c.done}
                  canPrivate={now - Date.parse(c.createdAt) < PRIVATE_REPLY_WINDOW_MS}
                  authorName={c.authorKnown ? c.authorName : "esta persona"}
                />
              </div>
            </li>
          );
          return (
            <li key={g.key} className="fl-card overflow-hidden p-0">
              <a
                href={post.permalink ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border-b border-border bg-surface-2/50 p-3 transition hover:bg-surface-2"
              >
                {post.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.image} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-surface text-xl" aria-hidden="true">
                    📝
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    <NetworkBadge network={network} />
                    {ad ? `Anuncio de ${NETWORK_STYLE[network].label}${ad.campaign ? ` · ${ad.campaign}` : ""}` : `Publicación de ${NETWORK_STYLE[network].label}`}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-ink">{post.text || "Publicación sin texto"}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1 text-xs">
                  {pending > 0 ? (
                    <span className="rounded-full bg-accent/20 px-2.5 py-1 font-semibold text-ink">
                      {pending} sin responder
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface px-2.5 py-1 font-semibold text-ink-muted">✓ Al día</span>
                  )}
                  <span className="text-ink-faint">
                    {g.comments.length} {g.comments.length === 1 ? "comentario" : "comentarios"} ↗
                  </span>
                </span>
              </a>
              <ul className="divide-y divide-border">{shown.map(renderComment)}</ul>
              {rest.length > 0 && (
                <details className="group border-t border-border">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-accent hover:bg-surface-2/60">
                    <span className="group-open:hidden">Ver {rest.length === 1 ? "el otro comentario" : `los otros ${rest.length} comentarios`} de esta publicación</span>
                    <span className="hidden group-open:inline">Ocultar los demás</span>
                  </summary>
                  <ul className="divide-y divide-border border-t border-border">{rest.map(renderComment)}</ul>
                </details>
              )}
            </li>
          );
        })}
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
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Revisamos tus últimas 12 publicaciones de cada red y tus anuncios recientes. Los comentarios nuevos aparecen solos.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
