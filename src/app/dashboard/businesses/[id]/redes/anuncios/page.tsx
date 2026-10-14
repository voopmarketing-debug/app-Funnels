import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseRange, todayInColombia } from "@/lib/socialRanges";
import { RedesTabs } from "../RedesTabs";
import { DateRangePicker } from "../DateRangePicker";
import { AdsReport } from "../AdsReport";

// Meta Ads on their own tab, with their own dates: looking back a year at old
// campaigns shouldn't change the dates of followers and posts.

function AdsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="fl-card h-72 animate-pulse" />
      <div className="fl-card h-40 animate-pulse" />
      <div className="fl-card h-64 animate-pulse" />
    </div>
  );
}

export default async function AnunciosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const { desde, hasta } = await searchParams;
  const today = todayInColombia();
  const range = parseRange({ desde, hasta }, today);

  const session = await auth();
  if (!session?.user?.id) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, socialConnection: { select: { adAccountId: true, adAccountName: true, userAccessToken: true } } } } },
  });
  if (!membership) notFound();
  const { business } = membership;
  const connection = business.socialConnection;
  const canManage = membership.role !== "MEMBER";
  const ready = Boolean(connection?.adAccountId && connection.userAccessToken);

  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-4">
        <Link href={`/dashboard/businesses/${id}`} className="text-sm text-ink-muted underline hover:text-ink">
          ← {business.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Redes sociales</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">Tus anuncios de Facebook e Instagram: cuánto invertiste, qué te trajeron y qué hacer con cada campaña.</p>
          </div>
          <RedesTabs businessId={id} active="anuncios" />
        </div>
        {ready && (
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker value={range} today={today} label="Fechas de anuncios" />
            {connection?.adAccountName && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink">📣 {connection.adAccountName}</span>
            )}
          </div>
        )}
      </header>

      {ready ? (
        <Suspense key={`${range.since}:${range.until}`} fallback={<AdsSkeleton />}>
          <AdsReport businessId={id} range={range} canManage={canManage} />
        </Suspense>
      ) : (
        <section className="fl-card-hero space-y-3 p-6">
          <h2 className="text-lg font-semibold">Conecta tu cuenta publicitaria</h2>
          <p className="text-sm text-ink-muted">
            Para ver tus anuncios, conecta Facebook y elige tu cuenta publicitaria en la pestaña Métricas. Solo pedimos permisos de lectura: no tocamos tus anuncios.
          </p>
          {canManage && (
            <Link
              href={`/dashboard/businesses/${id}/redes${connection ? "?choose=1" : ""}`}
              className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              {connection ? "Elegir cuenta publicitaria" : "Ir a conectar"}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
