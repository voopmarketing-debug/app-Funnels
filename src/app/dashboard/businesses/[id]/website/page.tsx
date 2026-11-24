import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteHome } from "./WebsiteHome";
import { listTemplateCards } from "@/lib/websiteNicheTemplates";

export default async function WebsitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true, wabaAccessToken: true, wabaPhoneNumberId: true, brandPrimaryColor: true, brandSecondaryColor: true } } },
  });
  if (!membership) notFound();

  const [websites, totalViews, totalClicksWhatsapp, totalClicksAgenda, totalLeads, totalAppointments, productCount, showcaseProducts, libraryPhotos, owner, latestLanding, savedDraft] = await Promise.all([
    prisma.website.findMany({
      where: { businessId: id },
      orderBy: { generatedAt: "asc" },
      select: {
        id: true,
        pageType: true,
        name: true,
        purpose: true,
        slug: true,
        model: true,
        generatedAt: true,
        customDomain: true,
        metaPixelId: true,
        googleTagId: true,
        _count: {
          select: {
            events: { where: { type: "view" } },
            leads: true,
            // An agenda-type page has no WebsiteLead rows of its own (its
            // "registro" is a booking, not the lead-capture form) — counted
            // here so its card shows real engagement instead of always 0.
            appointments: { where: { status: "confirmed" } },
          },
        },
      },
    }),
    prisma.websiteEvent.count({ where: { type: "view", website: { businessId: id } } }),
    prisma.websiteEvent.count({ where: { type: "cta_click", destination: "whatsapp", website: { businessId: id } } }),
    prisma.websiteEvent.count({ where: { type: "cta_click", destination: "agenda", website: { businessId: id } } }),
    prisma.websiteLead.count({ where: { website: { businessId: id } } }),
    prisma.appointment.count({ where: { status: "confirmed", website: { businessId: id } } }),
    // What the template library and the AI studio need.
    prisma.product.count({ where: { businessId: id, active: true } }),
    prisma.product.count({ where: { businessId: id, active: true, imageUrl: { not: null } } }),
    prisma.agentMedia.count({ where: { businessId: id, mediaType: "image" } }),
    prisma.membership.findFirst({ where: { businessId: id, role: "OWNER" }, select: { user: { select: { phone: true } } } }),
    prisma.website.findFirst({ where: { businessId: id, pageType: "landing" }, orderBy: { generatedAt: "desc" }, select: { content: true } }),
    // What this person was deciding with the AI the last time, so a reload or another device continues it.
    prisma.websiteCreationDraft.findUnique({ where: { userId_businessId: { userId: session.user.id, businessId: id } }, select: { data: true } }),
  ]);
  const cards = listTemplateCards();
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const pages = websites.map(({ model, ...w }) => ({
    ...w,
    templateLabel: model?.startsWith("template:") ? ((c) => (c ? `${c.nicheShort} · ${c.number} ${c.name}` : null))(cardById.get(model.slice(9))) : null,
    viewCount: w._count.events,
    leadCount: w._count.leads + w._count.appointments,
    hasTracking: !!(w.metaPixelId || w.googleTagId),
  }));
  const appHost = process.env.APP_HOST ?? "agente.funnelslabs.app";

  // Brand colors saved before, or the accent of the latest page.
  const pageContent = latestLanding?.content as { theme?: { primaryColor?: unknown }; primaryColor?: unknown } | null;
  const pagePrimary = pageContent?.theme?.primaryColor ?? pageContent?.primaryColor;
  const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  const brandPrimary = isHex(membership.business.brandPrimaryColor) ? membership.business.brandPrimaryColor : isHex(pagePrimary) ? pagePrimary : null;
  const brandSecondary = isHex(membership.business.brandSecondaryColor) ? membership.business.brandSecondaryColor : null;
  // Every button on a page leads to WhatsApp: without a connected line or a phone on the owner's
  // profile, the number is asked up front instead of failing at the very end.
  const hasWhatsapp = !!(membership.business.wabaAccessToken && membership.business.wabaPhoneNumberId) || !!owner?.user.phone?.trim();

  return (
    <WebsiteHome
      businessId={id}
      businessName={membership.business.name}
      initialTab={tab === "sitios" ? "sitios" : tab === "ia" ? "ia" : "plantillas"}
      cards={cards}
      hasDraft={!!savedDraft?.data}
      pagesList={{
        businessId: id,
        pages,
        publicUrlBase: `https://${appHost}/sitio`,
        stats: { totalViews, totalClicksWhatsapp, totalClicksAgenda, totalLeads: totalLeads + totalAppointments },
      }}
      studio={{
        businessId: id,
        businessName: membership.business.name,
        productCount,
        showcaseCount: showcaseProducts + libraryPhotos,
        needsWhatsapp: !hasWhatsapp,
        initialBrand: { primary: brandPrimary, secondary: brandSecondary },
        savedDraft: savedDraft?.data ?? null,
      }}
    />
  );
}
