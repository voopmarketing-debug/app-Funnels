import { NextRequest, NextResponse } from "next/server";
import { parseMpNotification, fetchMpPayment, fetchMpPreapproval, fetchMpAuthorizedPayment } from "@/lib/mercadopago";
import { applySubscriptionCharge } from "@/lib/payments";
import { mpPlanFor } from "@/lib/mercadopagoPlans";
import { prisma } from "@/lib/prisma";
import { ADDON_PACKS } from "@/lib/addonPacks";
import { activateAddon } from "@/lib/addons";
import { sendEmail } from "@/lib/email";

async function alertAgency(subject: string, detail: string) {
  console.error(subject, detail);
  const to = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (to) await sendEmail({ to, subject, html: `<p>${detail}</p>` }).catch(() => {});
}

function fullName(payer: { first_name?: string; last_name?: string }): string {
  return [payer.first_name, payer.last_name].filter(Boolean).join(" ");
}

// Mercado Pago has no shared-secret header like Hotmart's Hottok — the real
// safety check is that we always re-fetch the resource from MP's own API
// with our access token before provisioning anything (see mercadopago.ts).
export async function POST(req: NextRequest) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    console.error("MERCADOPAGO_ACCESS_TOKEN is not configured; rejecting webhook delivery.");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Some MP notifications arrive with an empty body and everything in
    // query params — that's fine, parseMpNotification falls back to those.
  }

  const notification = parseMpNotification(body, req.nextUrl.searchParams);
  if (!notification) {
    return NextResponse.json({ received: true, actioned: false });
  }

  try {
    if (notification.type === "payment") {
      const payment = await fetchMpPayment(notification.id);
      const payerEmail = payment?.payer.email?.trim().toLowerCase() ?? "";
      // Packs bought from inside the platform: our own id rides along as
      // external_reference, so the pack lands on the right account even if
      // they paid with a different email.
      if (payment?.approved && payment.externalReference?.startsWith("addon:")) {
        const addonId = payment.externalReference.slice("addon:".length);
        const addon = await prisma.accountAddon.findUnique({ where: { id: addonId } });
        if (addon && payment.currency === "COP" && payment.amount >= addon.priceCop) {
          await activateAddon(addon.id, { mpPaymentId: payment.id });
        } else {
          await alertAgency(
            "Pago de paquete sin activar",
            `Pago ${payment.id} (${payment.amount} ${payment.currency}) con referencia ${payment.externalReference} no coincide con un paquete pendiente. Revísalo en Mercado Pago.`,
          );
        }
        return NextResponse.json({ received: true, actioned: true });
      }
      // Packs paid through a fixed Mercado Pago link (no reference): match
      // the pack by its exact price and the account by the payer's email.
      const pack = payment?.approved ? ADDON_PACKS.find((p) => p.priceCop === payment.amount && payment.currency === "COP") : undefined;
      if (payment && pack) {
        const user = payerEmail ? await prisma.user.findUnique({ where: { email: payerEmail }, select: { id: true } }) : null;
        const already = await prisma.accountAddon.findUnique({ where: { mpPaymentId: payment.id } });
        if (user && !already) {
          const addon = await prisma.accountAddon.create({
            data: { userId: user.id, packKey: pack.key, kind: pack.kind, quantity: pack.quantity, priceCop: pack.priceCop },
          });
          await activateAddon(addon.id, { mpPaymentId: payment.id });
        } else if (!user) {
          await alertAgency(
            "Pago de paquete: no encontramos la cuenta",
            `Llegó un pago de ${pack.title} (${payment.amount} COP, pago ${payment.id}) del correo ${payerEmail || "(sin correo)"}, que no coincide con ninguna cuenta. Actívalo a mano desde Clientes.`,
          );
        }
        return NextResponse.json({ received: true, actioned: true });
      }
      // Refund or chargeback of a plan payment we applied: membership ends.
      if (payment && (payment.status === "refunded" || payment.status === "charged_back") && payerEmail) {
        await applySubscriptionCharge({
          provider: "mercadopago",
          transaction: `payment:${payment.id}`,
          action: "revoke",
          event: payment.status,
          email: payerEmail,
          name: fullName(payment.payer),
          phone: "",
          productName: payment.description,
        });
        return NextResponse.json({ received: true, actioned: true });
      }
      // A plan bought with a Mercado Pago link (one-time or a subscription's
      // monthly charge): create the account if new and extend its membership.
      if (payment?.approved && payerEmail) {
        const plan = mpPlanFor(payment.description, payment.amount);
        if (!plan) {
          await alertAgency(
            "Pago de Mercado Pago sin plan reconocido",
            `Llegó un pago de ${payment.amount} ${payment.currency} (${payment.description || "sin descripción"}, pago ${payment.id}) de ${payerEmail}. No coincide con ningún plan ni paquete; actívalo a mano desde Clientes si corresponde.`,
          );
          return NextResponse.json({ received: true, actioned: false });
        }
        await applySubscriptionCharge({
          provider: "mercadopago",
          transaction: `payment:${payment.id}`,
          action: "grant",
          event: "payment.approved",
          email: payerEmail,
          name: fullName(payment.payer),
          phone: payment.payer.phone?.number ?? "",
          productName: payment.description,
          planTier: plan.planTier,
          chargeDate: payment.approvedAt ?? new Date(),
        });
      }
    } else if (notification.type === "subscription_preapproval" || notification.type === "preapproval") {
      // The client authorized a monthly subscription: activate right away.
      // Later monthly charges arrive as subscription_authorized_payment.
      const sub = await fetchMpPreapproval(notification.id);
      // Created from the app's trial page: our account id rides along, so it
      // lands on the right account even if they paid with another email.
      const accountEmail = sub?.externalReference?.startsWith("user:")
        ? (await prisma.user.findUnique({ where: { id: sub.externalReference.slice(5) }, select: { email: true } }))?.email
        : undefined;
      const email = accountEmail ?? sub?.email;
      if (sub?.approved && email) {
        const plan = mpPlanFor(sub.reason, sub.amount) ?? { planTier: "STARTER" as const, months: 1 };
        await applySubscriptionCharge({
          provider: "mercadopago",
          transaction: `preapproval:${sub.id}`,
          action: "grant",
          event: "preapproval.authorized",
          email,
          name: "",
          phone: "",
          productName: sub.reason,
          planTier: plan.planTier,
          chargeDate: sub.createdAt,
          trialDays: sub.trialDays || undefined,
        });
      }
    } else if (notification.type === "subscription_authorized_payment") {
      const charge = await fetchMpAuthorizedPayment(notification.id);
      const sub = charge?.approved && charge.preapprovalId ? await fetchMpPreapproval(charge.preapprovalId) : null;
      const accountEmail = sub?.externalReference?.startsWith("user:")
        ? (await prisma.user.findUnique({ where: { id: sub.externalReference.slice(5) }, select: { email: true } }))?.email
        : undefined;
      if (charge && sub && (accountEmail ?? sub.email)) {
        const plan = mpPlanFor(sub.reason, sub.amount) ?? { planTier: "STARTER" as const, months: 1 };
        await applySubscriptionCharge({
          provider: "mercadopago",
          transaction: `authorized:${charge.id}`,
          action: "grant",
          event: "subscription_authorized_payment",
          email: (accountEmail ?? sub.email)!,
          name: "",
          phone: "",
          productName: sub.reason,
          planTier: plan.planTier,
          chargeDate: charge.chargedAt,
        });
      }
    }
  } catch (err) {
    console.error("Failed to apply Mercado Pago notification:", err, notification);
    // 500 so Mercado Pago retries: a failed charge releases its claim (see
    // lib/payments.ts), so the retry applies it.
    return new NextResponse("Error applying notification", { status: 500 });
  }

  return NextResponse.json({ received: true, actioned: true });
}
