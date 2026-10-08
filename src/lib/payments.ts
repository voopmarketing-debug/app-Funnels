import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { provisionClientFromPurchase } from "@/lib/provisioning";
import type { PlanTier } from "@prisma/client";
import {
  RENEWAL_GRACE_DAYS,
  billingMonthsFromProductName,
  extendSubscriptionEnd,
  planTierFromProductName,
  type HotmartAction,
  type HotmartPurchase,
} from "@/lib/hotmart";
import { PLAN_LABELS } from "@/lib/plans";

export type PaymentProvider = "hotmart" | "mercadopago";

const PROVIDER_LABEL: Record<PaymentProvider, string> = { hotmart: "Hotmart", mercadopago: "Mercado Pago" };

/** One subscription charge (or its refund), whatever the payment provider. */
export type SubscriptionCharge = {
  provider: PaymentProvider;
  // The provider's id for this charge; each renewal is a different one.
  transaction: string;
  action: HotmartAction;
  event: string;
  email: string;
  name: string;
  phone: string;
  productName: string;
  // When the provider says which plan it is; otherwise read from productName.
  planTier?: PlanTier;
  chargeDate?: Date;
  // A free trial instead of a paid period: access for this many days.
  trialDays?: number;
};

export type PaymentResult =
  | { status: "activated"; businessIds: string[]; endsAt: Date; newAccount: boolean }
  | { status: "revoked"; businessIds: string[] }
  | { status: "duplicate" }
  | { status: "ignored"; reason: string };

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(d);
}

async function alertAgency(subject: string, lines: string[]): Promise<void> {
  const to = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (!to) return;
  await sendEmail({ to, subject, html: lines.map((l) => `<p>${l}</p>`).join("") }).catch((err) =>
    console.error("Failed to email the agency about a payment:", err),
  );
}

/**
 * Applies a Hotmart charge to the buyer's account, exactly once per
 * transaction: a paid charge creates the account if it's new (see
 * provisioning.ts) and extends the paid period of every line it owns; a
 * refund or chargeback ends it. Renewals are their own transactions, so
 * each month's charge pushes the end date forward on its own.
 */
export async function applyHotmartPayment(purchase: HotmartPurchase & { action: HotmartAction }): Promise<PaymentResult> {
  return applySubscriptionCharge({ provider: "hotmart", ...purchase });
}

/**
 * Applies a subscription charge exactly once per (provider, transaction):
 * creates the account if it's new, sets the plan and extends the paid
 * period of every line it owns; a refund or chargeback ends it.
 */
export async function applySubscriptionCharge(purchase: SubscriptionCharge): Promise<PaymentResult> {
  const email = purchase.email.trim().toLowerCase();

  // Claim the transaction first so a retried or duplicate delivery can't
  // apply it twice; released again if applying it fails, so Hotmart's retry
  // can try once more.
  let claimId: string;
  try {
    const claim = await prisma.paymentEvent.create({
      data: { provider: purchase.provider, transaction: purchase.transaction, action: purchase.action, event: purchase.event, email },
    });
    claimId = claim.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { status: "duplicate" };
    throw err;
  }

  try {
    if (purchase.action === "revoke") return await revoke(purchase, email);
    return await grant(purchase, email);
  } catch (err) {
    await prisma.paymentEvent.delete({ where: { id: claimId } }).catch(() => {});
    throw err;
  }
}

async function ownedBusinessIds(email: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { memberships: { where: { role: "OWNER" }, select: { businessId: true } } },
  });
  return user?.memberships.map((m) => m.businessId) ?? [];
}

async function grant(purchase: SubscriptionCharge, email: string): Promise<PaymentResult> {
  const planTier = purchase.planTier ?? planTierFromProductName(purchase.productName);
  const months = billingMonthsFromProductName(purchase.productName);

  let newAccount = false;
  let businessIds = await ownedBusinessIds(email);
  if (businessIds.length === 0) {
    const result = await provisionClientFromPurchase({
      businessName: purchase.name || purchase.productName || "Nuevo negocio",
      email,
      phone: purchase.phone,
      planTier,
    });
    if (result.status === "error") throw new Error(result.message);
    newAccount = result.status === "created";
    businessIds = result.status === "created" ? [result.businessId] : await ownedBusinessIds(email);
  }
  if (businessIds.length === 0) return { status: "ignored", reason: "La cuenta no es dueña de ningún negocio" };

  const now = new Date();
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true, subscriptionStartedAt: true, subscriptionEndsAt: true },
  });
  // One subscription covers every line the account owns: all of them end on
  // the same date, the latest one any of them already had.
  const latestEnd = businesses.reduce<Date | null>((max, b) => (b.subscriptionEndsAt && (!max || b.subscriptionEndsAt > max) ? b.subscriptionEndsAt : max), null);
  const endsAt = purchase.trialDays
    ? trialEnd(latestEnd, purchase.trialDays, purchase.chargeDate ?? now)
    : extendSubscriptionEnd(latestEnd, months, purchase.chargeDate ?? now);
  const restarting = !latestEnd || latestEnd <= now;

  await prisma.$transaction(
    businesses.map((b) =>
      prisma.business.update({
        where: { id: b.id },
        data: {
          subscriptionEndsAt: endsAt,
          ...(restarting || !b.subscriptionStartedAt ? { subscriptionStartedAt: now } : {}),
          ...(planTier ? { planTier } : {}),
        },
      }),
    ),
  );

  // A self-registered account waiting on its card can use the dashboard now.
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, activationRequired: true } });
  if (owner?.activationRequired) {
    await prisma.user.update({ where: { id: owner.id }, data: { activationRequired: false } });
    await sendWelcomeEmail(email, owner.name ?? purchase.name, endsAt, !!purchase.trialDays);
  }

  await alertAgency(newAccount ? `Nuevo cliente: ${purchase.name || email}` : purchase.trialDays ? `Prueba gratis iniciada: ${purchase.name || email}` : `Pago recibido: ${purchase.name || email}`, [
    `${newAccount ? "Se creó la cuenta y se activó" : "Se renovó"} automáticamente la membresía de <b>${purchase.name || email}</b> (${email}).`,
    `Producto: ${purchase.productName || "—"}${planTier ? ` · Plan ${PLAN_LABELS[planTier]}` : ""}`,
    `Activa hasta el <b>${formatDate(endsAt)}</b>. Negocios: ${businesses.map((b) => b.name).join(", ")}.`,
    `Pago ${PROVIDER_LABEL[purchase.provider]}: ${purchase.transaction}`,
  ]);

  return { status: "activated", businessIds, endsAt, newAccount };
}

function trialEnd(currentEnd: Date | null, trialDays: number, start: Date): Date {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + trialDays + RENEWAL_GRACE_DAYS);
  return currentEnd && currentEnd > end ? new Date(currentEnd) : end;
}

async function sendWelcomeEmail(email: string, name: string, endsAt: Date, trial: boolean): Promise<void> {
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  await sendEmail({
    to: email,
    subject: trial ? "Tu prueba gratis de Funnels Labs ya empezó" : "Tu cuenta de Funnels Labs ya está activa",
    html: `
      <p>Hola${name ? ` ${name}` : ""},</p>
      <p>${trial ? "Tu prueba gratis ya está activa" : "Tu cuenta ya está activa"}. Entra con el correo y la contraseña que creaste:</p>
      <p><a href="https://${host}/login">Iniciar sesión en Funnels Labs</a></p>
      ${trial ? `<p>Tu prueba va hasta el ${formatDate(endsAt)}. Ese día se hace el primer cobro a la tarjeta que registraste; puedes cancelar antes desde Mercado Pago.</p>` : ""}
      <p>¿Necesitas ayuda para conectar tu WhatsApp? Respóndenos este correo o escríbenos por WhatsApp.</p>
    `,
  }).catch((err) => console.error("Failed to send welcome email:", err));
}

async function revoke(purchase: SubscriptionCharge, email: string): Promise<PaymentResult> {
  // Only a charge we actually applied can be taken back.
  const granted = await prisma.paymentEvent.findUnique({
    where: { provider_transaction_action: { provider: purchase.provider, transaction: purchase.transaction, action: "grant" } },
  });
  if (!granted) return { status: "ignored", reason: "No había un pago aplicado con esa transacción" };

  const businessIds = await ownedBusinessIds(email);
  if (businessIds.length > 0) {
    await prisma.business.updateMany({ where: { id: { in: businessIds } }, data: { subscriptionEndsAt: new Date() } });
  }
  await alertAgency(`Reembolso o contracargo: ${purchase.name || email}`, [
    `${PROVIDER_LABEL[purchase.provider]} reportó <b>${/CHARGEBACK|charged_back/i.test(purchase.event) ? "un contracargo" : "un reembolso"}</b> de ${purchase.name || email} (${email}).`,
    `Su membresía quedó vencida desde ahora. Si fue un error, puedes reactivarla en Clientes.`,
    `Pago ${PROVIDER_LABEL[purchase.provider]}: ${purchase.transaction}`,
  ]);
  return { status: "revoked", businessIds };
}
