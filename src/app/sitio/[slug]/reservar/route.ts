import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submitAgendaBooking, previewAgendaBookingOutcome } from "@/lib/agendaBooking";

// Handles an agenda page's booking form (see lib/agendaTemplate.ts's
// .booking-form) — books the slot and emails both sides (see
// lib/agendaBooking.ts), then redirects back to the page with the
// confirmation shown (or, on failure, back to the same time-slot step with
// an error so they can pick a different one — the slot they wanted may
// have just been taken by someone else).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preview = req.nextUrl.searchParams.get("preview") === "1";

  const website = await prisma.website.findUnique({
    where: { slug },
    select: {
      id: true,
      pageType: true,
      business: { select: { name: true } },
      agendaConfig: {
        select: {
          notificationEmail: true,
          slotMinutes: true,
          professionals: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!website || website.pageType !== "agenda" || !website.agendaConfig) {
    return new NextResponse("Agenda no encontrada", { status: 404 });
  }

  const formData = await req.formData();
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

  const url = new URL(`/sitio/${slug}`, req.url);
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
