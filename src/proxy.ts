import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { renderWebsiteHtml } from "@/lib/websiteTemplate";
import { getWebsiteHeroContext } from "@/lib/websiteHero";
import { renderAgendaHtml } from "@/lib/agendaTemplate";
import { AvailabilitySchema, DEFAULT_AVAILABILITY, getUpcomingAvailableDates, getAvailableSlotsForDate } from "@/lib/agenda";
import { submitAgendaBooking, previewAgendaBookingOutcome } from "@/lib/agendaBooking";
import { captureWebsiteLead } from "@/lib/websiteLeads";
import { customDomainSecurityHeaders } from "@/lib/securityHeaders";

// Hosts this app already answers for on purpose — everything else that
// reaches this deployment has been manually connected in Vercel as a
// client's own domain or a dedicated FunnelsLabs subdomain (e.g.
// clinica-sonrisa.funnelslabs.app) for one specific generated page (see
// Website.customDomain, set from the "Dominio propio" field in the website
// editor). No code change or redeploy is needed to connect a new one —
// once the domain points here and its DB row has this hostname saved, this
// proxy starts serving it automatically.
const APP_HOSTS = new Set(["agente.funnelslabs.app", "localhost:3000", "localhost"]);

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();

  if (APP_HOSTS.has(host) || APP_HOSTS.has(hostname) || hostname.endsWith(".vercel.app")) {
    return NextResponse.next();
  }

  const website = await prisma.website.findUnique({
    where: { customDomain: hostname },
    select: {
      id: true,
      pageType: true,
      content: true,
      whatsappNumber: true,
      businessId: true,
      aiImageUrl: true,
      business: { select: { name: true, industry: true } },
      agendaConfig: {
        select: {
          notificationEmail: true,
          timezone: true,
          slotMinutes: true,
          availability: true,
          primaryColor: true,
          professionals: {
            where: { active: true },
            orderBy: { position: "asc" },
            select: { id: true, name: true, title: true, email: true, availability: true },
          },
        },
      },
    },
  });

  if (!website) {
    // Unknown host with nothing connected — fall through to normal routing
    // (will 404 through the app like any unmatched request).
    return NextResponse.next();
  }

  const preview = request.nextUrl.searchParams.get("preview") === "1";

  if (website.pageType === "agenda") {
    if (!website.agendaConfig) {
      return new NextResponse(
        "Esta agenda todavía no está configurada — pide al dueño del negocio que entre a su panel y termine de configurarla.",
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...customDomainSecurityHeaders() } },
      );
    }

    // Same booking-form POST as /sitio/[slug]/reservar, reached here as a
    // root-relative "/reservar" action since a custom domain has no slug.
    if (request.nextUrl.pathname === "/reservar" && request.method === "POST") {
      const formData = await request.formData();
      const professionalId = String(formData.get("professional") ?? "");
      const professional = website.agendaConfig.professionals.find((p) => p.id === professionalId) ?? null;

      const outcome = preview
        ? previewAgendaBookingOutcome(formData)
        : await submitAgendaBooking({
            websiteId: website.id,
            businessName: website.business.name,
            notificationEmail: website.agendaConfig.notificationEmail,
            formData,
            slotMinutes: website.agendaConfig.slotMinutes,
            professional,
          });

      const url = new URL("/", request.url);
      if (preview) url.searchParams.set("preview", "1");
      if (professional) url.searchParams.set("professional", professional.id);
      if (outcome.ok) {
        url.searchParams.set("reservado_fecha", outcome.dateStr);
        url.searchParams.set("reservado_hora", outcome.timeStr);
      } else {
        url.searchParams.set("date", outcome.dateStr);
        url.searchParams.set("error", outcome.error);
      }
      return NextResponse.redirect(url, { status: 303 });
    }

    if (!preview) {
      try {
        await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "view" } });
      } catch (err) {
        console.error("Failed to log website view event:", err);
      }
    }

    const professionals = website.agendaConfig.professionals;
    const professionalParam = request.nextUrl.searchParams.get("professional");
    const selectedProfessional = professionals.find((p) => p.id === professionalParam) ?? null;
    const needsProfessionalPick = professionals.length > 0 && !selectedProfessional;
    const availability = AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(
      selectedProfessional ? selectedProfessional.availability : website.agendaConfig.availability,
    );
    const dateStr = request.nextUrl.searchParams.get("date");
    const timeStr = request.nextUrl.searchParams.get("time");
    const confirmedDate = request.nextUrl.searchParams.get("reservado_fecha");
    const confirmedTime = request.nextUrl.searchParams.get("reservado_hora");
    const bookingError = request.nextUrl.searchParams.get("error");

    const upcomingDates =
      needsProfessionalPick || dateStr ? [] : getUpcomingAvailableDates(availability, website.agendaConfig.timezone, 10);
    const availableSlots =
      !needsProfessionalPick && dateStr && !timeStr
        ? await getAvailableSlotsForDate({
            websiteId: website.id,
            dateStr,
            availability,
            slotMinutes: website.agendaConfig.slotMinutes,
            timezone: website.agendaConfig.timezone,
            professionalId: selectedProfessional?.id ?? null,
          })
        : [];

    const html = renderAgendaHtml({
      businessName: website.business.name,
      primaryColor: website.agendaConfig.primaryColor,
      trackingBasePath: "",
      professionals: professionals.map((p) => ({ id: p.id, name: p.name, title: p.title })),
      professionalId: selectedProfessional?.id ?? null,
      upcomingDates,
      dateStr,
      availableSlots,
      timeStr,
      confirmed: confirmedDate && confirmedTime ? { dateStr: confirmedDate, timeStr: confirmedTime } : null,
      bookingError,
      preview,
    });

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...customDomainSecurityHeaders() },
    });
  }

  const parsedContent = WebsiteContentSchema.safeParse(website.content);
  if (!parsedContent.success) {
    // Content saved under an earlier version of the schema — ask the
    // owner to regenerate rather than showing a raw error to visitors.
    return new NextResponse(
      "Esta página necesita actualizarse — pide al dueño del negocio que entre a su panel y le dé 'Regenerar todo con IA'.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...customDomainSecurityHeaders() } },
    );
  }
  const content = parsedContent.data;

  // Same lead-capture form POST as /sitio/[slug]/registro, reached here as
  // a root-relative "/registro" action since a custom domain has no slug.
  if (request.nextUrl.pathname === "/registro" && request.method === "POST") {
    const formData = await request.formData();
    const ok = await captureWebsiteLead(website.id, formData);
    const url = new URL("/", request.url);
    if (ok) url.searchParams.set("registrado", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  // Same click-through redirect as /sitio/[slug]/ir, reached here as a
  // root-relative "/ir" link since a custom domain has no slug in its path.
  if (request.nextUrl.pathname === "/ir") {
    const label = request.nextUrl.searchParams.get("label") ?? "unknown";
    const destination = content.hero.ctaUrl ? "agenda" : "whatsapp";
    const target = content.hero.ctaUrl || `https://wa.me/${website.whatsappNumber.replace(/[^0-9]/g, "")}`;

    try {
      await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "cta_click", label, destination } });
    } catch (err) {
      console.error("Failed to log website click event:", err);
    }

    return NextResponse.redirect(target, { status: 302 });
  }

  try {
    await prisma.websiteEvent.create({ data: { websiteId: website.id, type: "view" } });
  } catch (err) {
    console.error("Failed to log website view event:", err);
  }

  const { eyebrow, heroImageUrl } = await getWebsiteHeroContext(
    website.businessId,
    website.business.industry,
    website.aiImageUrl,
  );

  const html = renderWebsiteHtml(content, {
    businessName: website.business.name,
    whatsappNumber: website.whatsappNumber,
    trackingBasePath: "",
    leadSubmitted: request.nextUrl.searchParams.get("registrado") === "1",
    eyebrow,
    heroImageUrl,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...customDomainSecurityHeaders() },
  });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
