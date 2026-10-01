import { NextRequest, NextResponse } from "next/server";
import { parseMpNotification, fetchMpPayment, fetchMpPreapproval } from "@/lib/mercadopago";
import { provisionClientFromPurchase } from "@/lib/provisioning";
import { prisma } from "@/lib/prisma";
import { ADDON_PACKS } from "@/lib/addonPacks";
import { activateAddon } from "@/lib/addons";
import { sendEmail } from "@/lib/email";

async function alertAgency(subject: string, detail: string) {
  console.error(subject, detail);
  const to = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (to) await sendEmail({ to, subject, html: `<p>${detail}</p>` }).catch(() => {});
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
      if (payment?.approved && payment.payer.email) {
        const name = [payment.payer.first_name, payment.payer.last_name].filter(Boolean).join(" ");
        await provisionClientFromPurchase({
          businessName: name || "Nuevo negocio",
          email: payment.payer.email,
          phone: payment.payer.phone?.number ?? "",
        });
      }
    } else if (notification.type === "subscription_preapproval" || notification.type === "preapproval") {
      const sub = await fetchMpPreapproval(notification.id);
      if (sub?.approved && sub.email) {
        await provisionClientFromPurchase({ businessName: "Nuevo negocio", email: sub.email, phone: "" });
      }
    }
  } catch (err) {
    console.error("Failed to provision client from Mercado Pago notification:", err, notification);
    // Still 200 — MP retries aggressively on non-2xx, and we already logged
    // this for manual follow-up.
  }

  return NextResponse.json({ received: true, actioned: true });
}
