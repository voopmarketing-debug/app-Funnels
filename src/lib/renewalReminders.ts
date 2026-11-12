import { Prisma } from "@prisma/client";
import { escapeHtml } from "@/lib/htmlEscape";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { fetchMpPreapproval } from "@/lib/mercadopago";
import { PLAN_LABELS } from "@/lib/plans";
import { appHost } from "@/lib/trial";
import { renewalContext } from "@/lib/renewal";

// Emails that ask the owner to renew before the plan ends, so the agent never
// stops without warning: 5 days before, the day before, and once it has ended.
// Run by the scheduled job; each one goes out once per paid period.

export type ReminderKind = "d5" | "d1" | "d0";

const DAY_MS = 86_400_000;
// A reminder that was missed (the job was down) is still worth sending for this long after the end.
const LATE_DAYS = 3;

/** Which reminder is due for a plan ending at `endsAt`; null when none is. */
export function reminderKindFor(endsAt: Date, now: Date): ReminderKind | null {
  const ms = endsAt.getTime() - now.getTime();
  if (ms > 5 * DAY_MS) return null;
  if (ms > DAY_MS) return "d5";
  if (ms > 0) return "d1";
  if (ms > -LATE_DAYS * DAY_MS) return "d0";
  return null;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(d);
}

export function reminderEmail(
  kind: ReminderKind,
  info: { name: string | null; planLabel: string; priceCop: number; endsAt: Date | null; host: string },
): { subject: string; html: string } {
  const date = info.endsAt ? formatDate(info.endsAt) : "pronto";
  const subject =
    kind === "d5"
      ? "Tu plan de Funnels Labs vence en pocos días"
      : kind === "d1"
        ? "Mañana vence tu plan de Funnels Labs"
        : "Tu plan de Funnels Labs venció: tu agente dejó de responder";
  const line =
    kind === "d5"
      ? `Tu plan vence el ${date}. Renueva con un clic para que tu agente no se detenga.`
      : kind === "d1"
        ? `Tu plan vence mañana (${date}). Después, tu agente deja de responder a tus clientes.`
        : "Tu plan venció y tu agente dejó de responder. Renueva y vuelve a atender al instante: tus datos siguen guardados.";
  const price = new Intl.NumberFormat("es-CO").format(info.priceCop);
  const html = `
    <p>Hola${info.name ? ` ${escapeHtml(info.name)}` : ""},</p>
    <p>${line}</p>
    <p><a href="https://${escapeHtml(info.host)}/renovar" style="display:inline-block;background:#b6f23a;color:#111;font-weight:700;padding:12px 22px;border-radius:10px;text-decoration:none">Renovar ahora</a></p>
    <p style="color:#666;font-size:13px">Plan ${escapeHtml(info.planLabel)} · $${price} COP al mes. Puedes pagar con tarjeta (se renueva sola), PSE o Nequi. Si ya renovaste, ignora este correo.</p>`;
  return { subject, html };
}

/** Sends one reminder to an account's owner; false if its email didn't go out. */
export async function sendRenewalReminder(userId: string, kind: ReminderKind): Promise<boolean> {
  const [ctx, user] = await Promise.all([
    renewalContext(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
  ]);
  if (!ctx || !user) return false;
  const { subject, html } = reminderEmail(kind, {
    name: user.name,
    planLabel: PLAN_LABELS[ctx.planTier],
    priceCop: ctx.priceCop,
    endsAt: ctx.endsAt,
    host: appHost(),
  });
  return sendEmail({ to: user.email, subject, html });
}

/** Whether something other than us renews this account: a live Mercado Pago card subscription or Hotmart. null = couldn't tell. */
async function renewsItself(user: { email: string; mpPreapprovalId: string | null }): Promise<boolean | null> {
  if (user.mpPreapprovalId) {
    const sub = await fetchMpPreapproval(user.mpPreapprovalId);
    if (!sub) return null;
    return sub.approved;
  }
  const latest = await prisma.paymentEvent.findFirst({
    where: { email: user.email.toLowerCase(), action: "grant" },
    orderBy: { createdAt: "desc" },
    select: { provider: true },
  });
  return latest?.provider === "hotmart";
}

export type ReminderRun = { checked: number; sent: number; skippedAuto: number; failed: number };

/**
 * Sends the reminders that are due. Safe to run as often as you like: each
 * (account, reminder, period end) is claimed in AppSetting first, so it goes
 * out once, and a new period (a renewal moves the end date) starts fresh.
 */
export async function runRenewalReminders(now = new Date()): Promise<ReminderRun> {
  const result: ReminderRun = { checked: 0, sent: 0, skippedAuto: 0, failed: 0 };
  const agencyEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();

  // Owners with any line ending inside the window; their real end is then the latest of ALL their lines.
  const candidates = await prisma.membership.findMany({
    where: {
      role: "OWNER",
      business: { subscriptionEndsAt: { gte: new Date(now.getTime() - LATE_DAYS * DAY_MS), lte: new Date(now.getTime() + 5 * DAY_MS) } },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  if (candidates.length === 0) return result;

  const users = await prisma.user.findMany({
    where: { id: { in: candidates.map((c) => c.userId) }, activationRequired: false },
    select: {
      id: true,
      email: true,
      mpPreapprovalId: true,
      memberships: { where: { role: "OWNER" }, select: { business: { select: { subscriptionEndsAt: true } } } },
    },
  });

  for (const user of users) {
    if (agencyEmail && user.email.toLowerCase() === agencyEmail) continue;
    const ends = user.memberships.map((m) => m.business.subscriptionEndsAt).filter((d): d is Date => !!d);
    if (ends.length === 0) continue;
    const endsAt = new Date(Math.max(...ends.map((d) => d.getTime())));
    const kind = reminderKindFor(endsAt, now);
    if (!kind) continue;
    result.checked++;

    const key = `renewal_reminder:${user.id}:${kind}:${endsAt.getTime()}`;
    try {
      await prisma.appSetting.create({ data: { key, value: "pending" } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue; // already handled
      throw err;
    }
    const release = () => prisma.appSetting.delete({ where: { key } }).catch(() => {});
    try {
      const itself = await renewsItself(user);
      if (itself === null) {
        await release(); // Mercado Pago didn't answer: ask again next run
        continue;
      }
      if (itself) {
        await prisma.appSetting.update({ where: { key }, data: { value: "auto" } });
        result.skippedAuto++;
        continue;
      }
      if (await sendRenewalReminder(user.id, kind)) {
        await prisma.appSetting.update({ where: { key }, data: { value: "sent" } });
        result.sent++;
      } else {
        await release(); // the email didn't go out: try again next run
        result.failed++;
      }
    } catch (err) {
      await release();
      result.failed++;
      console.error("Renewal reminder failed for", user.id, err);
    }
  }

  // Housekeeping: the claims of periods long over.
  await prisma.appSetting.deleteMany({ where: { key: { startsWith: "renewal_reminder:" }, updatedAt: { lt: new Date(now.getTime() - 90 * DAY_MS) } } });
  return result;
}
