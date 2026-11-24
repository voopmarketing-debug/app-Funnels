import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSiteTracking } from "@/lib/siteTracking";
import { renderStoredWebsite } from "@/lib/websiteRender";
import { renderAgendaHtml } from "@/lib/agendaTemplate";
import {
  AvailabilitySchema,
  DEFAULT_AVAILABILITY,
  ANY_PROFESSIONAL_ID,
  mergeAvailabilities,
  getUpcomingAvailableDates,
  getAvailableSlotsForDate,
  getAvailableSlotsForAnyProfessional,
} from "@/lib/agenda";
import { siteSecurityHeaders } from "@/lib/securityHeaders";
import { wantsPanelBack, withPanelBackLink } from "@/lib/panelBackLink";
import { allowThankYouRedirect, notPublishedHtml, withDraftRibbon } from "@/lib/sitePublish";
import { auth } from "@/auth";
import { FONT_OPTIONS } from "@/lib/websiteContent";
import type { WebsiteContentV2 } from "@/lib/websiteContentV2";

// Publicly serves one business page — no auth, meant to be shared/indexed
// like any regular website. Rendered fresh from the structured content on
// every request (see lib/websiteTemplate.ts), so an edit in the dashboard
// is live immediately — no separate "publish" step, no stale cached HTML.
// Branches on website.pageType: "landing" (the default, AI-generated
// content) or "agenda" (a real booking calendar — see lib/agendaTemplate.ts
// and app/sitio/[slug]/reservar/route.ts for the booking submission).
// Builder live preview: unsaved colors/fonts come in the query string of
// the preview iframe. Only hex colors and known fonts are accepted.
function themeOverrideFromQuery(params: URLSearchParams): Partial<WebsiteContentV2["theme"]> | undefined {
  const hex = (key: string) => {
    const v = params.get(key);
    return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
  };
  const font = (key: string) => {
    const v = params.get(key);
    return v && (FONT_OPTIONS as readonly string[]).includes(v) ? (v as WebsiteContentV2["theme"]["headingFont"]) : undefined;
  };
  const override = {
    primaryColor: hex("pc"),
    backgroundColor: hex("bg"),
    surfaceColor: hex("sc"),
    textColor: hex("tc"),
    headingFont: font("hf"),
    bodyFont: font("bf"),
  };
  const clean = Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined));
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const leadSubmitted = req.nextUrl.searchParams.get("registrado") === "1";
  // Set only by the dashboard's own "Vista previa" iframe (see
  // WebsiteEditor.tsx) — the owner opening their editor, or saving a
  // change and triggering a preview reload, isn't a real visitor and
  // shouldn't inflate their own view count.
  let preview = req.nextUrl.searchParams.get("preview") === "1";

  const website = await prisma.website.findUnique({
    where: { slug },
    select: {
      id: true,
      published: true,
      pageType: true,
      metaPixelId: true,
      googleTagId: true,
      content: true,
      whatsappNumber: true,
      businessId: true,
      aiImageUrl: true,
      business: { select: { name: true, industry: true } },
      agendaConfig: {
        select: {
          timezone: true,
          slotMinutes: true,
          availability: true,
          primaryColor: true,
          professionals: {
            where: { active: true },
            orderBy: { position: "asc" },
            select: { id: true, name: true, title: true, availability: true },
          },
        },
      },
    },
  });
  if (!website) {
    return new NextResponse("Sitio no encontrado", { status: 404, headers: siteSecurityHeaders() });
  }

  // A page the owner unpublished (a draft): visitors see a neutral message; a member of the
  // business still sees the page, as a preview that counts no visits.
  let isDraftForOwner = false;
  if (!website.published) {
    const session = await auth();
    const member = session?.user?.id
      ? await prisma.membership.findUnique({ where: { userId_businessId: { userId: session.user.id, businessId: website.businessId } }, select: { id: true } })
      : null;
    if (!member) {
      return new NextResponse(notPublishedHtml(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...siteSecurityHeaders() } });
    }
    isDraftForOwner = true;
    preview = true;
  }

  // The owner opening the page from the dashboard (installed app, no browser bar) gets a way back.
  const withBack = (html: string) => {
    const back = !preview && wantsPanelBack(req.nextUrl.searchParams) ? withPanelBackLink(html, `/dashboard/businesses/${website.businessId}/website`) : html;
    return isDraftForOwner && req.nextUrl.searchParams.get("preview") !== "1" ? withDraftRibbon(back) : back;
  };

  if (!preview) {
    try {
      await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "view" } });
    } catch (err) {
      console.error("Failed to log website view event:", err);
    }
  }

  if (website.pageType === "agenda") {
    if (!website.agendaConfig) {
      return new NextResponse(
        "Esta agenda todavía no está configurada — pide al dueño del negocio que entre a su panel y termine de configurarla.",
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...siteSecurityHeaders() } },
      );
    }
    const professionals = website.agendaConfig.professionals;
    const professionalParam = req.nextUrl.searchParams.get("professional");
    const selectedProfessional = professionals.find((p) => p.id === professionalParam) ?? null;
    const isAnyProfessional = professionalParam === ANY_PROFESSIONAL_ID;
    const needsProfessionalPick = professionals.length > 0 && !selectedProfessional && !isAnyProfessional;
    const parsedProfessionalAvailabilities = professionals.map((p) => AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(p.availability));
    const availability = selectedProfessional
      ? AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(selectedProfessional.availability)
      : isAnyProfessional
        ? mergeAvailabilities(parsedProfessionalAvailabilities)
        : AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(website.agendaConfig.availability);
    const dateStr = req.nextUrl.searchParams.get("date");
    const timeStr = req.nextUrl.searchParams.get("time");
    const confirmedDate = req.nextUrl.searchParams.get("reservado_fecha");
    const confirmedTime = req.nextUrl.searchParams.get("reservado_hora");
    const bookingError = req.nextUrl.searchParams.get("error");

    const upcomingDates =
      needsProfessionalPick || dateStr ? [] : getUpcomingAvailableDates(availability, website.agendaConfig.timezone, 10);
    const availableSlots =
      needsProfessionalPick || !dateStr || timeStr
        ? []
        : isAnyProfessional
          ? await getAvailableSlotsForAnyProfessional({
              websiteId: website.id,
              dateStr,
              professionals: professionals.map((p) => ({ id: p.id, availability: p.availability })),
              slotMinutes: website.agendaConfig.slotMinutes,
              timezone: website.agendaConfig.timezone,
            })
          : await getAvailableSlotsForDate({
              websiteId: website.id,
              dateStr,
              availability,
              slotMinutes: website.agendaConfig.slotMinutes,
              timezone: website.agendaConfig.timezone,
              professionalId: selectedProfessional?.id ?? null,
            });

    const html = renderAgendaHtml({
      businessName: website.business.name,
      primaryColor: website.agendaConfig.primaryColor,
      trackingBasePath: `/sitio/${slug}`,
      professionals: professionals.map((p) => ({ id: p.id, name: p.name, title: p.title })),
      professionalId: professionalParam,
      upcomingDates,
      dateStr,
      availableSlots,
      timeStr,
      confirmed: confirmedDate && confirmedTime ? { dateStr: confirmedDate, timeStr: confirmedTime } : null,
      bookingError,
      preview,
    });

    const tracked = withSiteTracking(
      withBack(html),
      { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...siteSecurityHeaders() },
      { metaPixelId: website.metaPixelId, googleTagId: website.googleTagId },
      { preview, events: { schedule: !!(confirmedDate && confirmedTime) } },
    );
    return new NextResponse(tracked.html, { headers: tracked.headers });
  }

  const html = await renderStoredWebsite(website, {
    trackingBasePath: `/sitio/${slug}`,
    leadSubmitted,
    preview,
    // The builder's click-to-edit preview (markers for texts, images and sections).
    edit: preview && req.nextUrl.searchParams.get("edit") === "1",
    themeOverride: preview ? themeOverrideFromQuery(req.nextUrl.searchParams) : undefined,
  });
  if (!html) {
    // Content saved under an earlier version of the schema — ask the
    // owner to regenerate rather than showing a raw 500 to visitors.
    return new NextResponse(
      "Esta página necesita actualizarse — pide al dueño del negocio que entre a su panel y le dé 'Regenerar todo con IA'.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...siteSecurityHeaders() } },
    );
  }

  const tracked = withSiteTracking(
    withBack(html),
    { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...siteSecurityHeaders() },
    { metaPixelId: website.metaPixelId, googleTagId: website.googleTagId },
    { preview: preview, events: { lead: leadSubmitted } },
  );
  return new NextResponse(tracked.html, { headers: allowThankYouRedirect(tracked.headers, website.content) });
}
