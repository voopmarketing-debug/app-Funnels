import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSiteTracking } from "@/lib/siteTracking";
import { renderStoredWebsite, resolveClickTarget } from "@/lib/websiteRender";
import { AGENDA_CONFIG_SELECT, renderAgendaPage } from "@/lib/agendaPage";
import { submitAgendaBooking, previewAgendaBookingOutcome } from "@/lib/agendaBooking";
import { captureWebsiteLead } from "@/lib/websiteLeads";
import { blockedBookingOutcome, publicFormBlock } from "@/lib/abuseGuard";
import { customDomainSecurityHeaders } from "@/lib/securityHeaders";
import { allowThankYouRedirect, notPublishedHtml, thankYouTarget } from "@/lib/sitePublish";
import { HTML_BLOCK_HEADERS, htmlBlockFromContent } from "@/lib/htmlBlock";
import { STORE_APP_COOKIE, STORE_APP_COOKIE_MAX_AGE, STORE_APP_HIDDEN_PATHS, storeAppFromValue } from "@/lib/storeApp";

// Hosts this app already answers for on purpose — everything else that
// reaches this deployment has been manually connected in Vercel as a
// client's own domain or a dedicated FunnelsLabs subdomain (e.g.
// clinica-sonrisa.funnelslabs.app) for one specific generated page (see
// Website.customDomain, set from the "Dominio propio" field in the website
// editor). No code change or redeploy is needed to connect a new one —
// once the domain points here and its DB row has this hostname saved, this
// proxy starts serving it automatically.
// agenda.funnelslabs.app only reaches this app through the routing rule
// that rewrites its /agenda page to /agenda-llamada.
const APP_HOSTS = new Set(["agente.funnelslabs.app", "agenda.funnelslabs.app", "localhost:3000", "localhost"]);

// The main domain shows only the offer page (the platform itself lives on agente.funnelslabs.app, which keeps
// working as it is): "/" is the offer, its files load, and any other page goes to the platform's address.
const OFFER_HOST = "funnelslabs.app";
const PLATFORM_ORIGIN = "https://agente.funnelslabs.app";

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();

  if (hostname === OFFER_HOST || hostname === `www.${OFFER_HOST}`) {
    const { pathname, search } = request.nextUrl;
    if (hostname.startsWith("www.")) return NextResponse.redirect(`https://${OFFER_HOST}${pathname}${search}`, 308);
    if (pathname === "/" || pathname === "/oferta") return NextResponse.rewrite(new URL("/oferta", request.url));
    // Files of the page (images, videos, fonts) have an extension.
    if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return NextResponse.next();
    return NextResponse.redirect(`${PLATFORM_ORIGIN}${pathname}${search}`, 308);
  }

  if (APP_HOSTS.has(host) || APP_HOSTS.has(hostname) || hostname.endsWith(".vercel.app")) {
    // Inside the Android / iPhone app from the stores (it opens ?app=android|ios): no purchase
    // screens. The cookie is set here so the very first page already knows (see lib/storeApp.ts).
    const appParam = request.nextUrl.searchParams.get("app");
    const launching = storeAppFromValue(appParam);
    const inStoreApp = launching || storeAppFromValue(request.cookies.get(STORE_APP_COOKIE)?.value);
    const remember = (response: NextResponse) => {
      if (launching) response.cookies.set({ name: STORE_APP_COOKIE, value: appParam, path: "/", maxAge: STORE_APP_COOKIE_MAX_AGE, sameSite: "lax", secure: true });
      return response;
    };
    if (inStoreApp && STORE_APP_HIDDEN_PATHS.has(request.nextUrl.pathname)) {
      return remember(NextResponse.redirect(new URL("/login", request.url)));
    }
    // Phones that installed the app before it opened on "Cargando tu sesión" still start it on /dashboard
    // (iOS keeps the address it saw when the icon was added). A bare launch there (a page request with
    // no referrer) gets the loading screen at once instead of a white wait; the screen then goes to
    // /dashboard with a referrer, so it is never shown twice.
    const bareLaunch =
      !launching &&
      request.method === "GET" &&
      request.nextUrl.pathname === "/dashboard" &&
      !request.nextUrl.search &&
      !request.headers.get("referer") &&
      !request.headers.has("rsc") &&
      !request.headers.has("next-router-prefetch") &&
      (request.headers.get("accept") ?? "").includes("text/html");
    if (bareLaunch) return NextResponse.rewrite(new URL("/abrir", request.url));
    if (!launching) return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.set("cookie", `${request.headers.get("cookie") ?? ""}; ${STORE_APP_COOKIE}=${appParam}`);
    return remember(NextResponse.next({ request: { headers } }));
  }

  const website = await prisma.website.findUnique({
    where: { customDomain: hostname },
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
      agendaConfig: { select: AGENDA_CONFIG_SELECT },
    },
  });

  if (!website) {
    // Unknown host with nothing connected — fall through to normal routing
    // (will 404 through the app like any unmatched request).
    return NextResponse.next();
  }

  const preview = request.nextUrl.searchParams.get("preview") === "1";

  // A page the owner unpublished is not shown on its own domain (the owner sees the draft from the dashboard).
  if (!website.published) {
    return new NextResponse(notPublishedHtml(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...customDomainSecurityHeaders() } });
  }

  // The frame of a "Código HTML" block, reached as a root-relative "/bloque/<n>" on a custom domain.
  const blockMatch = /^\/bloque\/(\d{1,2})$/.exec(request.nextUrl.pathname);
  if (blockMatch) {
    const doc = htmlBlockFromContent(website.content, Number(blockMatch[1]));
    return doc ? new NextResponse(doc, { headers: HTML_BLOCK_HEADERS }) : new NextResponse("No encontrado", { status: 404 });
  }

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
      const block = preview ? null : await publicFormBlock(formData, request.headers, website.id, "booking");

      const outcome = preview
        ? previewAgendaBookingOutcome(formData)
        : block
          ? blockedBookingOutcome(block, formData)
          : await submitAgendaBooking({
              websiteId: website.id,
              businessName: website.business.name,
              notificationEmail: website.agendaConfig.notificationEmail,
              formData,
              slotMinutes: website.agendaConfig.slotMinutes,
              address: website.agendaConfig.address,
              mapUrl: website.agendaConfig.mapUrl,
              fields: website.agendaConfig.fields,
              askNote: website.agendaConfig.askNote,
              professionals: website.agendaConfig.professionals,
            });

      const url = new URL("/", request.url);
      if (preview) url.searchParams.set("preview", "1");
      if (preview && request.nextUrl.searchParams.get("draft")) url.searchParams.set("draft", request.nextUrl.searchParams.get("draft") as string);
      const serviceId = String(formData.get("service") ?? "").trim().slice(0, 40);
      if (serviceId) url.searchParams.set("service", serviceId);
      if (outcome.ok && outcome.professionalId) url.searchParams.set("professional", outcome.professionalId);
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

    const { html, booked } = await renderAgendaPage({
      websiteId: website.id,
      businessName: website.business.name,
      whatsappNumber: website.whatsappNumber,
      config: website.agendaConfig,
      query: request.nextUrl.searchParams,
      trackingBasePath: "",
      preview,
    });

    const tracked = withSiteTracking(
      html,
      { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...customDomainSecurityHeaders() },
      { metaPixelId: website.metaPixelId, googleTagId: website.googleTagId },
      { preview, events: { schedule: booked } },
    );
    return new NextResponse(tracked.html, { headers: tracked.headers });
  }


  // Same lead-capture form POST as /sitio/[slug]/registro, reached here as
  // a root-relative "/registro" action since a custom domain has no slug.
  if (request.nextUrl.pathname === "/registro" && request.method === "POST") {
    const formData = await request.formData();
    const block = await publicFormBlock(formData, request.headers, website.id, "lead");
    const ok = block === "bot" ? true : block === "limited" ? false : await captureWebsiteLead(website.id, formData);
    const thanks = ok ? thankYouTarget(website.content) : null;
    if (thanks) return NextResponse.redirect(thanks, { status: 303 });
    const url = new URL("/", request.url);
    if (ok) url.searchParams.set("registrado", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  // Same click-through redirect as /sitio/[slug]/ir, reached here as a
  // root-relative "/ir" link since a custom domain has no slug in its path.
  if (request.nextUrl.pathname === "/ir") {
    const label = request.nextUrl.searchParams.get("label") ?? "unknown";
    const { target, destination } = await resolveClickTarget(website, request.nextUrl.searchParams.get("p"));

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

  const html = await renderStoredWebsite(website, {
    trackingBasePath: "",
    leadSubmitted: request.nextUrl.searchParams.get("registrado") === "1",
  });
  if (!html) {
    // Content saved under an earlier version of the schema — ask the
    // owner to regenerate rather than showing a raw error to visitors.
    return new NextResponse(
      "Esta página necesita actualizarse — pide al dueño del negocio que entre a su panel y le dé 'Regenerar todo con IA'.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...customDomainSecurityHeaders() } },
    );
  }

  const tracked = withSiteTracking(
    html,
    { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...customDomainSecurityHeaders() },
    { metaPixelId: website.metaPixelId, googleTagId: website.googleTagId },
    { preview: request.nextUrl.searchParams.get("preview") === "1", events: { lead: request.nextUrl.searchParams.get("registrado") === "1" } },
  );
  return new NextResponse(tracked.html, { headers: allowThankYouRedirect(tracked.headers, website.content) });
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
