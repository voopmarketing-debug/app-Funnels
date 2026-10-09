import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPushToBusiness } from "@/lib/push";
import { clientIpFrom, overLimit } from "@/lib/abuseGuard";
import { AGENDA_QUESTIONS, answerLabel, colombiaSlot, isQualifiedLead } from "@/lib/agencyAgenda";
import { bookedStageAfter } from "@/lib/autoStage";

// Bookings from Funnels Labs' own page (agenda.funnelslabs.app/agenda) into
// the agency's CRM: the contact, the appointment and the answers to the
// qualifying questions, so whoever takes the call knows who they're
// talking to. The email and the calendar event are still handled by the
// booking Apps Script; this is the CRM copy.

const ALLOWED_ORIGINS = new Set(["https://agenda.funnelslabs.app", "https://agente.funnelslabs.app"]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) || (process.env.VERCEL_ENV !== "production" && origin.startsWith("http://localhost"));
  return allowed ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
}

const answerValue = (id: (typeof AGENDA_QUESTIONS)[number]["id"]) =>
  z.enum(AGENDA_QUESTIONS.find((q) => q.id === id)!.options.map((o) => o.value) as [string, ...string[]]).optional();

const BodySchema = z.object({
  leadId: z.string().max(64).optional(),
  nombre: z.string().trim().min(2).max(120),
  telefono: z.string().max(30),
  correo: z.string().trim().max(160).optional().default(""),
  fecha: z.string().max(10),
  hora: z.string().max(5),
  respuestas: z.object({ negocio: answerValue("negocio"), mensajes: answerValue("mensajes"), inicio: answerValue("inicio") }).default({}),
  diagnostico: z.string().max(80).optional().default(""),
  website_url: z.string().max(200).optional().default(""),
});

// The agency's own business: AGENCY_AGENDA_BUSINESS_ID when set, otherwise
// the oldest business the agency account owns.
async function agencyBusinessId(): Promise<string | null> {
  const configured = process.env.AGENCY_AGENDA_BUSINESS_ID?.trim();
  if (configured) return configured;
  const email = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const membership = await prisma.membership.findFirst({
    where: { role: "OWNER", user: { email } },
    orderBy: { business: { createdAt: "asc" } },
    select: { businessId: true },
  });
  return membership?.businessId ?? null;
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const ok = () => Response.json({ ok: true }, { headers: cors });

  let body: z.infer<typeof BodySchema>;
  try {
    // Sent as text/plain so the browser skips the CORS preflight.
    body = BodySchema.parse(JSON.parse(await req.text()));
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: cors });
  }
  // A bot filled the hidden field: pretend it worked, keep nothing.
  if (body.website_url.trim()) return ok();
  if (await overLimit(`agenda-llamada:${clientIpFrom(req.headers)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ ok: false }, { status: 429, headers: cors });
  }

  const phone = body.telefono.replace(/[^0-9]/g, "");
  const businessId = await agencyBusinessId();
  if (phone.length < 7 || !businessId) {
    if (!businessId) console.warn("[agenda-llamada] no agency business found (set AGENCY_AGENDA_BUSINESS_ID)");
    return ok();
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { businessId, pipeline: { isDefault: true } },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true },
  });
  if (stages.length === 0) return ok();

  const appointmentAt = colombiaSlot(body.fecha, body.hora);
  const qualified = isQualifiedLead(body.respuestas);
  const summary = [
    `📅 Agendó por agenda.funnelslabs.app${appointmentAt ? ` para el ${body.fecha} a las ${body.hora} (hora Colombia)` : ""}.`,
    `• Negocio: ${answerLabel("negocio", body.respuestas.negocio)}`,
    `• Mensajes al mes por WhatsApp: ${answerLabel("mensajes", body.respuestas.mensajes)}`,
    `• Quiere empezar: ${answerLabel("inicio", body.respuestas.inicio)}`,
    body.diagnostico ? `• Diagnóstico: ${body.diagnostico}` : null,
    body.correo ? `• Correo: ${body.correo}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const tags = ["Agenda web", qualified ? "Lead calificado" : "Por calificar"];

  const existing = await prisma.conversation.findUnique({
    where: { businessId_customerPhone: { businessId, customerPhone: phone } },
    select: { id: true, stageId: true, notes: true, tags: true },
  });
  // New leads start in the funnel's "Agendado"-type stage when it has one;
  // existing ones only ever move forward.
  const booked = bookedStageAfter(stages, existing?.stageId ?? stages[0].id);
  const appointment = appointmentAt ? { appointmentAt, appointmentNote: "Llamada con Funnels Labs" } : {};

  const conversation = existing
    ? await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          customerName: body.nombre,
          ...(body.correo && { customerEmail: body.correo.toLowerCase() }),
          notes: existing.notes ? `${existing.notes}\n\n${summary}` : summary,
          tags: Array.from(new Set([...existing.tags.filter((t) => t !== "Por calificar" || !qualified), ...tags])),
          ...(booked && { stageId: booked.id }),
          ...appointment,
        },
        select: { id: true },
      })
    : await prisma.conversation.create({
        data: {
          businessId,
          customerPhone: phone,
          customerName: body.nombre,
          customerEmail: body.correo ? body.correo.toLowerCase() : null,
          stageId: booked?.id ?? stages[0].id,
          notes: summary,
          tags,
          ...appointment,
        },
        select: { id: true },
      });

  const when = appointmentAt
    ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(appointmentAt)
    : "sin fecha";
  await prisma.notification.create({
    data: {
      businessId,
      conversationId: conversation.id,
      type: "APPOINTMENT_SCHEDULED",
      message: `📅 ${body.nombre} agendó una llamada para el ${when}${qualified ? "" : " (por calificar)"}`,
    },
  });
  await sendPushToBusiness(businessId, {
    title: `📅 Nueva llamada agendada · ${body.nombre}`,
    body: `${when} · ${answerLabel("negocio", body.respuestas.negocio)}`,
    url: `/dashboard/businesses/${businessId}/conversations/${conversation.id}`,
    tag: `agenda-${conversation.id}`,
  }).catch((err) => console.error("[push] agenda push failed", err));

  return ok();
}
