import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { checkAnthropic, checkOpenAi } from "@/lib/aiServiceHealth";
import { fetchWabaSubscribedApps, subscribeAppToWaba, verifyWabaConnection } from "@/lib/whatsapp";

// Why this exists: when WhatsApp stops delivering to us (expired token, the
// app unsubscribed from the number's account, a wrong app secret…) nothing
// fails on OUR side — customers write, and the messages simply never show
// up. These checks find those causes, and the alerts make sure a human hears
// about it the same day instead of noticing lost customers weeks later.

export type HealthCheck = { label: string; ok: boolean; detail: string };
export type WhatsAppHealth = { ok: boolean; checks: HealthCheck[]; canResubscribe: boolean };

const APP_HOST = process.env.APP_HOST ?? "agente.funnelslabs.app";

type HealthBusiness = {
  id: string;
  wabaPhoneNumberId: string | null;
  wabaAccessToken: string | null;
  wabaId: string | null;
  webhookError: string | null;
  webhookErrorAt: Date | null;
};

/** A receive error is only worth showing for a day — after that it's history, not current state. */
export function isRecentWebhookError(at: Date | null): boolean {
  return !!at && Date.now() - at.getTime() < 24 * 60 * 60 * 1000;
}

export async function checkWhatsAppHealth(business: HealthBusiness): Promise<WhatsAppHealth> {
  const checks: HealthCheck[] = [];
  let canResubscribe = false;

  if (!business.wabaPhoneNumberId || !business.wabaAccessToken) {
    checks.push({
      label: "Credenciales",
      ok: false,
      detail: "Falta el Phone Number ID o el token de Meta. Complétalos en «Credenciales de WhatsApp».",
    });
    return { ok: false, checks, canResubscribe };
  }

  if (!process.env.META_APP_SECRET) {
    checks.push({
      label: "Servidor",
      ok: false,
      detail: "Falta META_APP_SECRET en Vercel: todos los mensajes entrantes se rechazan.",
    });
  }

  const accessToken = decryptSecret(business.wabaAccessToken);
  const connection = await verifyWabaConnection({ phoneNumberId: business.wabaPhoneNumberId, accessToken });
  checks.push(
    connection.ok
      ? {
          label: "Número y token",
          ok: true,
          detail: `Meta acepta las credenciales${connection.displayPhoneNumber ? ` (${connection.displayPhoneNumber})` : ""}.`,
        }
      : { label: "Número y token", ok: false, detail: connection.error },
  );

  if (!business.wabaId) {
    checks.push({
      label: "Recepción de mensajes",
      ok: false,
      detail:
        "No se puede verificar sin el WhatsApp Business Account ID (WABA ID). Agrégalo en «Credenciales de WhatsApp».",
    });
  } else if (connection.ok) {
    const subscription = await fetchWabaSubscribedApps({ wabaId: business.wabaId, accessToken });
    if (!subscription.ok) {
      checks.push({ label: "Recepción de mensajes", ok: false, detail: `Meta no respondió: ${subscription.error}` });
    } else {
      const appId = process.env.META_APP_ID;
      const subscribed = appId ? subscription.appIds.includes(appId) : subscription.appIds.length > 0;
      canResubscribe = !subscribed;
      checks.push(
        subscribed
          ? { label: "Recepción de mensajes", ok: true, detail: "La app está suscrita: Meta nos envía los mensajes." }
          : {
              label: "Recepción de mensajes",
              ok: false,
              detail:
                "La app NO está suscrita a esta cuenta de WhatsApp: Meta no nos está enviando los mensajes de los clientes. Usa «Reconectar recepción».",
            },
      );
    }
  }

  if (business.webhookError && isRecentWebhookError(business.webhookErrorAt)) {
    checks.push({ label: "Últimos mensajes", ok: false, detail: business.webhookError });
  }

  // The AI side too: WhatsApp can be fine and customers still get nothing
  // if Anthropic rejects every call (e.g. an unpaid balance).
  checks.push(await checkAnthropic(), await checkOpenAi());

  return { ok: checks.every((c) => c.ok), checks, canResubscribe };
}

export async function resubscribeWhatsAppWebhook(business: HealthBusiness): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!business.wabaId || !business.wabaAccessToken) {
    return { ok: false, error: "Falta el WABA ID o el token en «Credenciales de WhatsApp»." };
  }
  return subscribeAppToWaba({ wabaId: business.wabaId, accessToken: decryptSecret(business.wabaAccessToken) });
}

/**
 * Bell notification + email to the business owner(s). Emails are throttled
 * per business (one per hour) so a burst of failures doesn't flood the
 * inbox; the bell gets every alert.
 */
async function alertBusiness(businessId: string, message: string, emailSubject: string, emailAllowed: boolean) {
  await prisma.notification.create({ data: { businessId, type: "WHATSAPP_ALERT", message } });
  if (!emailAllowed) return;
  const owners = await prisma.membership.findMany({
    where: { businessId, role: "OWNER" },
    select: { user: { select: { email: true } }, business: { select: { name: true } } },
  });
  await Promise.all(
    owners.map((o) =>
      sendEmail({
        to: o.user.email,
        subject: emailSubject,
        html: `<p>Hola,</p><p><strong>${o.business.name}</strong>: ${message}</p><p>Revisa el estado de la conexión en <a href="https://${APP_HOST}/dashboard/businesses/${businessId}">tu panel de Funnels Labs</a> (sección «Estado de WhatsApp»).</p>`,
      }),
    ),
  );
}

/**
 * A webhook delivery for this business failed on our side (bad signature,
 * crash before the message was saved). Recorded for the health panel and
 * alerted — throttled to once per 15 minutes per business so a retry storm
 * from Meta (or someone posting junk to the endpoint) can't spam alerts.
 */
export async function reportWebhookProblem(businessId: string, problem: string): Promise<void> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { webhookErrorAt: true } });
  if (!business) return;
  const now = new Date();
  const last = business.webhookErrorAt?.getTime() ?? 0;
  await prisma.business.update({ where: { id: businessId }, data: { webhookError: problem, webhookErrorAt: now } });
  if (now.getTime() - last < 15 * 60 * 1000) return;
  await alertBusiness(
    businessId,
    `⚠ WhatsApp: ${problem}`,
    "⚠ Un mensaje de WhatsApp no llegó a tu CRM",
    now.getTime() - last >= 60 * 60 * 1000,
  );
}

/** Same lookup as the webhook uses, for failures where only the phone_number_id is known. */
export async function reportWebhookProblemForPhoneNumberIds(phoneNumberIds: string[], problem: string): Promise<void> {
  if (phoneNumberIds.length === 0) return;
  const businesses = await prisma.business.findMany({
    where: { wabaPhoneNumberId: { in: phoneNumberIds } },
    select: { id: true },
  });
  await Promise.all(businesses.map((b) => reportWebhookProblem(b.id, problem)));
}

const HEALTH_SELECT = {
  id: true,
  wabaPhoneNumberId: true,
  wabaAccessToken: true,
  wabaId: true,
  webhookError: true,
  webhookErrorAt: true,
  whatsappHealthOk: true,
} as const;

/** Runs the check for one business, stores the result, and alerts only on an OK → broken (or broken → OK) change. */
export async function runWhatsAppHealthCheck(businessId: string): Promise<WhatsAppHealth | null> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: HEALTH_SELECT });
  if (!business) return null;
  const health = await checkWhatsAppHealth(business);
  const firstProblem = health.checks.find((c) => !c.ok);
  const summary = firstProblem ? `${firstProblem.label}: ${firstProblem.detail}` : "WhatsApp e IA funcionando.";

  await prisma.business.update({
    where: { id: businessId },
    data: { whatsappHealthOk: health.ok, whatsappHealthMessage: summary, whatsappHealthCheckedAt: new Date() },
  });

  if (!health.ok && business.whatsappHealthOk !== false) {
    await alertBusiness(
      businessId,
      `⚠ Tu agente dejó de responder. ${summary}`,
      "⚠ Tu agente de WhatsApp dejó de funcionar",
      true,
    );
  } else if (health.ok && business.whatsappHealthOk === false) {
    await prisma.notification.create({
      data: { businessId, type: "WHATSAPP_ALERT", message: "✅ Tu agente volvió a funcionar con normalidad." },
    });
  }
  return health;
}

/** Daily sweep over every connected business (called from the metric-alerts cron). */
export async function runAllWhatsAppHealthChecks(): Promise<{ checked: number; broken: number }> {
  const businesses = await prisma.business.findMany({
    where: { wabaPhoneNumberId: { not: null } },
    select: { id: true },
  });
  let broken = 0;
  const BATCH_SIZE = 10;
  for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
    const results = await Promise.all(
      businesses.slice(i, i + BATCH_SIZE).map((b) => runWhatsAppHealthCheck(b.id).catch(() => null)),
    );
    broken += results.filter((r) => r && !r.ok).length;
  }
  return { checked: businesses.length, broken };
}
