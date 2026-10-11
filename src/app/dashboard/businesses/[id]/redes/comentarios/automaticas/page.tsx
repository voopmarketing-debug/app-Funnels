import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RedesTabs } from "../../RedesTabs";
import { shortDateTime } from "../../format";
import { AutoReplyManager, type RuleView } from "./AutoReplyEditor";

// Keyword auto-replies for comments (ManyChat-style). The rules live here;
// lib/commentAutoReply.ts applies them from Meta's webhook and the sweep.

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  sent: { label: "Enviado", tone: "text-[var(--status-good)]" },
  partial: { label: "Enviado en parte", tone: "text-[var(--status-warn)]" },
  failed: { label: "No se pudo", tone: "text-[var(--status-bad)]" },
  pending: { label: "Enviando…", tone: "text-ink-muted" },
};

export default async function AutoRepliesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, socialConnection: { select: { fbPageId: true, igUserId: true, fbPageName: true } } } } },
  });
  if (!membership) notFound();
  const { business } = membership;
  const connection = business.socialConnection;
  const canEdit = membership.role !== "MEMBER";

  const [rules, logs] = await Promise.all([
    prisma.commentAutoReply.findMany({ where: { businessId: id }, orderBy: { createdAt: "asc" } }),
    prisma.commentAutoReplyLog.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const ruleName = new Map(rules.map((r) => [r.id, r.name]));
  const views: RuleView[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    keywords: r.keywords,
    networks: r.networks,
    publicReplies: r.publicReplies,
    privateMessage: r.privateMessage,
    enabled: r.enabled,
    replyCount: r.replyCount,
    lastTriggeredLabel: r.lastTriggeredAt ? shortDateTime(r.lastTriggeredAt.toISOString()) : null,
  }));

  return (
    <div className="min-w-0 space-y-6">
      <header className="space-y-4">
        <Link href={`/dashboard/businesses/${id}/redes/comentarios`} className="text-sm text-ink-muted underline hover:text-ink">
          ← Comentarios
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Respuestas automáticas</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Cuando alguien comenta una palabra clave en tus publicaciones (por ejemplo «INFO»), la plataforma le responde el comentario y le escribe por privado,
              sola y con tus palabras. No usa IA.
            </p>
          </div>
          <RedesTabs businessId={id} active="comentarios" />
        </div>
      </header>

      {!connection?.fbPageId && (
        <section className="fl-card-hero space-y-3 p-5">
          <h2 className="text-base font-semibold">Primero conecta tu página de Facebook</h2>
          <p className="text-sm text-ink-muted">Puedes dejar tus reglas listas; empiezan a responder cuando conectes tus redes en la pestaña Métricas.</p>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { n: "1", t: "Publica pidiendo una palabra", d: "Ej. «Comenta INFO y te enviamos los precios»." },
          { n: "2", t: "La plataforma la detecta", d: "En segundos, o máximo en 10 minutos. Solo comentarios nuevos." },
          { n: "3", t: "Responde y escribe por privado", d: "La conversación sigue en Redes → Mensajes con tu equipo." },
        ].map((s) => (
          <div key={s.n} className="fl-card flex gap-3 p-4">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">{s.n}</span>
            <div>
              <p className="text-sm font-semibold text-ink">{s.t}</p>
              <p className="text-xs text-ink-muted">{s.d}</p>
            </div>
          </div>
        ))}
      </section>

      <AutoReplyManager businessId={id} rules={views} hasIg={!!connection?.igUserId} canEdit={canEdit} />

      {logs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Últimas respuestas</h2>
          <div className="fl-card divide-y divide-border p-0">
            {logs.map((l) => {
              const s = STATUS_LABEL[l.status] ?? STATUS_LABEL.pending;
              return (
                <div key={l.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{l.author ?? "Alguien"}</span>{" "}
                    <span className="text-ink-muted">en {l.network === "instagram" ? "Instagram" : "Facebook"}: «{l.comment.slice(0, 120)}»</span>
                    {l.error && <span className="mt-0.5 block text-xs text-[var(--status-bad)]">{l.error}</span>}
                  </span>
                  <span className="text-xs text-ink-muted sm:flex-none sm:text-right">
                    {ruleName.get(l.ruleId) ?? "Regla borrada"} · <span className={`font-semibold ${s.tone}`}>{s.label}</span> · {shortDateTime(l.createdAt.toISOString())}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
