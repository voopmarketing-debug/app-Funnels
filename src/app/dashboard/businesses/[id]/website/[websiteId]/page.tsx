import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WebsiteContentSchema } from "@/lib/websiteContent";
import { AvailabilitySchema, DEFAULT_AVAILABILITY, parseMonthStr, getCurrentMonthStr } from "@/lib/agenda";
import { WebsiteEditor } from "./WebsiteEditor";
import { WebsiteBuilder } from "./WebsiteBuilder";
import { WebsiteContentV2Schema, isV2Content } from "@/lib/websiteContentV2";
import { AgendaEditor } from "./AgendaEditor";
import { parseServices } from "@/lib/agendaServices";
import { effectiveFields, parseAnswers } from "@/lib/agendaFields";
import { agendaStyleOrDefault } from "@/lib/agendaStyles";
import { TemplateBuilder } from "./TemplateBuilder";
import { isTemplateContent } from "@/lib/templateSite/content";
import { parseTemplateSite } from "@/lib/templateSite/render";

// Remaking a page with AI can take a few minutes.
export const maxDuration = 300;

export default async function WebsiteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; websiteId: string }>;
  searchParams: Promise<{ month?: string; tab?: string; week?: string }>;
}) {
  const { id, websiteId } = await params;
  const { month: monthParam, tab: tabParam, week: weekParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId: id } },
    include: { business: { select: { name: true } } },
  });
  if (!membership) notFound();

  const website = await prisma.website.findFirst({ where: { id: websiteId, businessId: id }, include: { agendaConfig: true } });
  if (!website) notFound();

  const appHost = process.env.APP_HOST ?? "agente.funnelslabs.app";

  if (website.pageType === "agenda") {
    const monthStr = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : getCurrentMonthStr();
    const { year, month } = parseMonthStr(monthStr);
    // Padded a day on each side so a booking near the month's edge in the
    // business's own timezone (which can differ from this query's UTC
    // boundaries) never gets silently dropped from the calendar.
    // The weekly view moves a month either way without another trip to the server.
    const monthQueryStart = new Date(Date.UTC(year, month - 1, 1) - 24 * 60 * 60 * 1000);
    const monthQueryEnd = new Date(Date.UTC(year, month + 2, 1) + 24 * 60 * 60 * 1000);

    const [totalAppointments, upcomingAppointments, monthAppointments, professionals, pipelines] = await Promise.all([
      prisma.appointment.count({ where: { websiteId, status: "confirmed" } }),
      prisma.appointment.findMany({
        where: { websiteId, status: "confirmed" },
        orderBy: { startsAt: "asc" },
        take: 20,
        select: { id: true, name: true, contact: true, startsAt: true, service: true, note: true, answers: true, professional: { select: { name: true } } },
      }),
      prisma.appointment.findMany({
        where: { websiteId, status: "confirmed", startsAt: { gte: monthQueryStart, lt: monthQueryEnd } },
        orderBy: { startsAt: "asc" },
        select: { id: true, name: true, contact: true, startsAt: true, durationMinutes: true, service: true, note: true, answers: true, professionalId: true, professional: { select: { name: true } } },
      }),
      website.agendaConfig
        ? prisma.professional.findMany({ where: { agendaConfigId: website.agendaConfig.id }, orderBy: { position: "asc" } })
        : Promise.resolve([]),
      prisma.pipeline.findMany({ where: { businessId: id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    ]);
    const availability = website.agendaConfig
      ? AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(website.agendaConfig.availability)
      : DEFAULT_AVAILABILITY;

    return (
      <div className="space-y-6">
        <div>
          <Link href={`/dashboard/businesses/${id}/website`} className="text-sm text-ink-muted underline hover:text-ink">
            ← Sitios web
          </Link>
          <h1 className="mt-1 text-xl font-bold">{website.name}</h1>
        </div>

        <AgendaEditor
          businessId={id}
          websiteId={websiteId}
          initialConfig={{
            notificationEmail: website.agendaConfig?.notificationEmail ?? session.user.email ?? "",
            timezone: website.agendaConfig?.timezone ?? "America/Bogota",
            slotMinutes: website.agendaConfig?.slotMinutes ?? 30,
            availability,
            primaryColor: website.agendaConfig?.primaryColor ?? "#1f6feb",
            style: agendaStyleOrDefault(website.agendaConfig?.style),
            title: website.agendaConfig?.title ?? "",
            subtitle: website.agendaConfig?.subtitle ?? "",
            address: website.agendaConfig?.address ?? "",
            mapUrl: website.agendaConfig?.mapUrl ?? "",
            logoUrl: website.agendaConfig?.logoUrl ?? "",
            askNote: website.agendaConfig?.askNote ?? true,
            services: parseServices(website.agendaConfig?.services),
            fields: effectiveFields(website.agendaConfig?.fields, website.agendaConfig?.askNote ?? true),
          }}
          customDomain={website.customDomain}
          tracking={{ metaPixelId: website.metaPixelId, googleTagId: website.googleTagId }}
          generatedAt={website.updatedAt}
          publicUrl={`https://${appHost}/sitio/${website.slug}`}
          totalAppointments={totalAppointments}
          upcomingAppointments={upcomingAppointments.map((a) => ({ ...a, answers: parseAnswers(a.answers) }))}
          monthStr={monthStr}
          initialWeek={weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : null}
          monthAppointments={monthAppointments.map((a) => ({ ...a, answers: parseAnswers(a.answers) }))}
          professionals={professionals.map((p) => ({
            id: p.id,
            name: p.name,
            title: p.title,
            email: p.email,
            photoUrl: p.photoUrl,
            active: p.active,
            availability: AvailabilitySchema.catch(DEFAULT_AVAILABILITY).parse(p.availability),
            pipelineId: p.pipelineId,
          }))}
          pipelines={pipelines}
        />
      </div>
    );
  }

  // Showroom / Scroll Story pages: fixed hand-designed templates, edited by chat.
  if (isTemplateContent(website.content)) {
    const template = parseTemplateSite(website.content);
    if (template) {
      const [views, clicks, leadCount] = await Promise.all([
        prisma.websiteEvent.count({ where: { websiteId, type: "view" } }),
        prisma.websiteEvent.count({ where: { websiteId, type: "cta_click" } }),
        prisma.websiteLead.count({ where: { websiteId } }),
      ]);
      return (
        <TemplateBuilder
          businessId={id}
          websiteId={websiteId}
          name={website.name}
          slug={website.slug}
          publicUrl={`https://${appHost}/sitio/${website.slug}`}
          templateLabel={template.template === "showroom" ? "Showroom · productos para comparar" : "Scroll Story · historia de marca"}
          stats={{ views, clicks, leads: leadCount }}
          tracking={{ metaPixelId: website.metaPixelId, googleTagId: website.googleTagId }}
          published={website.published}
        />
      );
    }
  }

  // New builder (v2 content): full-screen chat + design + live preview.
  if (isV2Content(website.content)) {
    const v2 = WebsiteContentV2Schema.safeParse(website.content);
    if (v2.success) {
      const [views, clicks, leadCount] = await Promise.all([
        prisma.websiteEvent.count({ where: { websiteId, type: "view" } }),
        prisma.websiteEvent.count({ where: { websiteId, type: "cta_click" } }),
        prisma.websiteLead.count({ where: { websiteId } }),
      ]);
      return (
        <WebsiteBuilder
          businessId={id}
          websiteId={websiteId}
          name={website.name}
          slug={website.slug}
          publicUrl={`https://${appHost}/sitio/${website.slug}`}
          initialContent={v2.data}
          stats={{ views, clicks, leads: leadCount }}
          tracking={{ metaPixelId: website.metaPixelId, googleTagId: website.googleTagId }}
          initialTab={tabParam === "ajustes" ? "ajustes" : "bloques"}
          published={website.published}
        />
      );
    }
  }

  const parsedContent = WebsiteContentSchema.safeParse(website.content);

  if (!parsedContent.success) {
    return (
      <div className="space-y-6">
        <Link href={`/dashboard/businesses/${id}/website`} className="text-sm text-ink-muted underline hover:text-ink">
          ← Sitios web
        </Link>
        <div className="fl-card space-y-2 p-6 text-center">
          <p className="text-sm font-medium text-ink">Esta página es de una versión anterior del sistema</p>
          <p className="text-xs text-ink-muted">
            Ya no se puede editar. Sigue publicada como está; para cambiarla, crea una nueva desde las plantillas.
          </p>
          <Link href={`/dashboard/businesses/${id}/website`} className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-accent-ink hover:bg-accent-hover">
            Ver las plantillas
          </Link>
        </div>
      </div>
    );
  }

  const [totalViews, clicksWhatsapp, clicksAgenda, leads, otherPages] = await Promise.all([
    prisma.websiteEvent.count({ where: { websiteId, type: "view" } }),
    prisma.websiteEvent.count({ where: { websiteId, type: "cta_click", destination: "whatsapp" } }),
    prisma.websiteEvent.count({ where: { websiteId, type: "cta_click", destination: "agenda" } }),
    prisma.websiteLead.findMany({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, contact: true, message: true, createdAt: true },
    }),
    // Lets the hero CTA link straight to another of this business's own
    // pages (typically its agenda page) instead of copy-pasting a URL.
    prisma.website.findMany({
      where: { businessId: id, id: { not: websiteId } },
      orderBy: { generatedAt: "asc" },
      select: { name: true, slug: true, pageType: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/businesses/${id}/website`}
          className="text-sm text-ink-muted underline hover:text-ink"
        >
          ← Sitios web
        </Link>
        <h1 className="mt-1 text-xl font-bold">{website.name}</h1>
        {website.purpose && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{website.purpose}</p>}
      </div>

      <WebsiteEditor
        businessId={id}
        websiteId={websiteId}
        content={parsedContent.data}
        customDomain={website.customDomain}
        tracking={{ metaPixelId: website.metaPixelId, googleTagId: website.googleTagId }}
        // updatedAt, not generatedAt: covers regenerations, AI edits and
        // manual saves alike, so the date always reflects the latest change.
        generatedAt={website.updatedAt}
        publicUrl={`https://${appHost}/sitio/${website.slug}`}
        stats={{ totalViews, clicksWhatsapp, clicksAgenda }}
        leads={leads}
        otherPages={otherPages.map((p) => ({ name: p.name, pageType: p.pageType, publicUrl: `https://${appHost}/sitio/${p.slug}` }))}
      />
    </div>
  );
}
