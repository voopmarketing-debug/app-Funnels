import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { fetchWhatsAppTemplateStatus, sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { reportWhatsAppSendFailure } from "@/lib/whatsappAlerts";
import { whatsAppErrorKind, type WhatsAppErrorKind } from "@/lib/whatsappErrors";

// The three appointment messages and how each one is delivered. Inside
// WhatsApp's 24-hour window the business can write freely; outside it Meta
// only delivers an approved template, so the same message exists in both
// forms and the window decides which one goes.

/** Meta's customer-care window: free-form messages are accepted for 24 h after the customer's last message. */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
// Treat the window as closing a little early: a message sent seconds before
// it closes can still be refused by the time it reaches Meta (131047).
const WINDOW_SAFETY_MS = 5 * 60 * 1000;

export function isInsideWhatsAppWindow(lastCustomerMessageAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastCustomerMessageAt) return false;
  return now.getTime() - lastCustomerMessageAt.getTime() < WHATSAPP_WINDOW_MS - WINDOW_SAFETY_MS;
}

export type AppointmentMessageKind = "confirmation" | "reminder" | "link";

/** The approved templates (Spanish) and how many {{variables}} each takes. */
export const APPOINTMENT_TEMPLATES: Record<AppointmentMessageKind, { name: string; language: string; paramCount: number }> = {
  confirmation: { name: "confirmacion_cita", language: "es", paramCount: 3 }, // {{1}} nombre, {{2}} fecha, {{3}} hora
  reminder: { name: "recordatorio_cita", language: "es", paramCount: 3 }, // {{1}} nombre, {{2}} fecha, {{3}} hora
  link: { name: "link_agendamiento", language: "es", paramCount: 2 }, // {{1}} nombre, {{2}} URL del calendario
};

/** "lunes 2 de noviembre" and "3:30 p. m.", in the business's own time zone. */
export function formatAppointmentWhen(startsAt: Date, timeZone: string): { date: string; time: string } {
  // Intl uses a comma after the weekday and non-breaking spaces in the time; plain text reads better in a message.
  const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ").replace(",", "");
  const date = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone }).format(startsAt);
  const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone }).format(startsAt);
  return { date: plain(date), time: plain(time) };
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "";
}

type Values = { name: string | null | undefined; date: string; time: string; url?: string };

/** The values in the order the templates number them. */
function orderedValues(kind: AppointmentMessageKind, v: Values): string[] {
  const name = firstName(v.name) || "cliente";
  return kind === "link" ? [name, v.url ?? ""] : [name, v.date, v.time];
}

/** How many {{N}} a template body has (the highest N). */
export function countTemplateVariables(bodyText: string): number {
  let max = 0;
  for (const m of bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/** What goes in each {{N}}: the standard order, cut or padded to the template's own count. */
export function templateParams(kind: AppointmentMessageKind, v: Values, count: number): string[] {
  const values = orderedValues(kind, v);
  return Array.from({ length: count }, (_, i) => values[i] || "-");
}

/** The same message as free text, for use inside the 24-hour window. */
export function appointmentText(kind: AppointmentMessageKind, v: Values & { businessName: string }): string {
  const hello = firstName(v.name) ? `Hola ${firstName(v.name)}` : "Hola";
  if (kind === "confirmation") return `${hello} 👋 Tu cita con ${v.businessName} quedó confirmada para el ${v.date} a las ${v.time}. Si necesitas cambiarla, respóndenos por aquí.`;
  if (kind === "reminder") return `${hello} 👋 Te recordamos tu cita con ${v.businessName} el ${v.date} a las ${v.time}. Si necesitas reprogramarla, respóndenos por aquí.`;
  return `${hello} 👋 Aquí puedes agendar tu cita con ${v.businessName}: ${v.url ?? ""}`;
}

/** The recipient as WhatsApp wants it: digits only, with the country code. A bare 10-digit Colombian mobile gets 57. */
export function normalizeRecipientPhone(contact: string): string {
  const digits = contact.replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
}

type SendBusiness = {
  id: string;
  name: string;
  wabaPhoneNumberId: string | null;
  wabaId: string | null;
  wabaAccessToken: string | null;
};

export type AppointmentSendResult =
  | { ok: true; via: "text" | "template"; messageId: string; text: string }
  | { ok: false; reason: "NO_WHATSAPP" | "NEEDS_TEMPLATE" | "SEND_FAILED"; kind?: WhatsAppErrorKind; error?: string };

/** The approved template to use: the business's own record, or (for one created straight in WhatsApp Manager) Meta's own answer. */
async function findApprovedTemplate(business: SendBusiness, accessToken: string, kind: AppointmentMessageKind): Promise<{ name: string; language: string; bodyText: string | null } | null> {
  const spec = APPOINTMENT_TEMPLATES[kind];
  const stored = await prisma.messageTemplate.findFirst({
    where: { businessId: business.id, status: "APPROVED", name: spec.name },
    orderBy: { updatedAt: "desc" },
    select: { name: true, language: true, bodyText: true },
  });
  if (stored) return stored;
  // Reminders also accept any approved template whose name starts with
  // "recordatorio", as before the standard names existed.
  if (kind === "reminder") {
    const legacy = await prisma.messageTemplate.findFirst({
      where: { businessId: business.id, status: "APPROVED", name: { startsWith: "recordatorio" } },
      orderBy: { updatedAt: "desc" },
      select: { name: true, language: true, bodyText: true },
    });
    if (legacy) return legacy;
  }
  if (!business.wabaId) return null;
  try {
    const remote = await fetchWhatsAppTemplateStatus({ wabaId: business.wabaId, accessToken, name: spec.name });
    return remote?.status === "APPROVED" ? { name: spec.name, language: spec.language, bodyText: null } : null;
  } catch {
    return null;
  }
}

/**
 * Sends one appointment message: free text inside the 24-hour window, the
 * approved template outside it (or when Meta refuses the text as out of
 * window). Returns what happened instead of throwing, so a failed WhatsApp
 * never blocks the booking or the reminder run; critical failures (invalid
 * token, template missing or paused) e-mail the owner of the platform.
 */
export async function sendAppointmentMessage(params: {
  kind: AppointmentMessageKind;
  business: SendBusiness;
  to: string;
  name: string | null | undefined;
  startsAt: Date;
  timeZone: string;
  url?: string;
  lastCustomerMessageAt: Date | null;
  now?: Date;
}): Promise<AppointmentSendResult> {
  const { kind, business, startsAt, timeZone } = params;
  if (!business.wabaPhoneNumberId || !business.wabaAccessToken) return { ok: false, reason: "NO_WHATSAPP" };
  const accessToken = decryptSecret(business.wabaAccessToken);
  const to = normalizeRecipientPhone(params.to);
  if (!to) return { ok: false, reason: "SEND_FAILED", error: "El contacto no tiene un número válido" };

  const when = formatAppointmentWhen(startsAt, timeZone);
  const values: Values = { name: params.name, date: when.date, time: when.time, url: params.url };
  const text = appointmentText(kind, { ...values, businessName: business.name });
  const context = { confirmation: "confirmación de cita", reminder: "recordatorio de cita", link: "enlace de agendamiento" }[kind];

  const sendTemplate = async (): Promise<AppointmentSendResult> => {
    const template = await findApprovedTemplate(business, accessToken, kind);
    if (!template) return { ok: false, reason: "NEEDS_TEMPLATE" };
    const count = template.bodyText === null ? APPOINTMENT_TEMPLATES[kind].paramCount : countTemplateVariables(template.bodyText);
    try {
      const { messageId } = await sendWhatsAppTemplateMessage({
        phoneNumberId: business.wabaPhoneNumberId!,
        accessToken,
        to,
        templateName: template.name,
        language: template.language,
        bodyParams: count > 0 ? templateParams(kind, values, count) : undefined,
      });
      return { ok: true, via: "template", messageId, text };
    } catch (err) {
      await reportWhatsAppSendFailure(err, { businessId: business.id, context });
      return { ok: false, reason: "SEND_FAILED", kind: whatsAppErrorKind(err), error: err instanceof Error ? err.message : String(err) };
    }
  };

  if (!isInsideWhatsAppWindow(params.lastCustomerMessageAt, params.now)) return sendTemplate();

  try {
    const { messageId } = await sendWhatsAppTextMessage({ phoneNumberId: business.wabaPhoneNumberId, accessToken, to, text });
    return { ok: true, via: "text", messageId, text };
  } catch (err) {
    // Our clock said "inside the window" and Meta disagrees: use the template instead.
    if (whatsAppErrorKind(err) === "OUT_OF_WINDOW") return sendTemplate();
    await reportWhatsAppSendFailure(err, { businessId: business.id, context });
    return { ok: false, reason: "SEND_FAILED", kind: whatsAppErrorKind(err), error: err instanceof Error ? err.message : String(err) };
  }
}

/** When the customer last wrote to this business, matched by phone with or without the country code; null if never. */
export async function lastCustomerMessageAt(businessId: string, contact: string): Promise<{ conversationId: string | null; at: Date | null }> {
  const full = normalizeRecipientPhone(contact);
  const bare = full.startsWith("57") && full.length === 12 ? full.slice(2) : full;
  const conversation = await prisma.conversation.findFirst({
    where: { businessId, customerPhone: { in: [...new Set([full, bare])] } },
    select: { id: true },
    orderBy: { lastMessageAt: "desc" },
  });
  if (!conversation) return { conversationId: null, at: null };
  const last = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return { conversationId: conversation.id, at: last?.createdAt ?? null };
}
