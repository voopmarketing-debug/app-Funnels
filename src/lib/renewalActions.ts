"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/email";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { isAgencyAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { oneMonthCheckout, renewalContext, renewalPlanCheckout } from "@/lib/renewal";
import { reminderKindFor, sendRenewalReminder } from "@/lib/renewalReminders";

export type RenewalState = { error: string | null };

/**
 * From Clientes: emails an account's owner the renewal reminder right now
 * (the same message the automatic ones send), for a client who is slow to
 * pay. Agency only, and only for owners of businesses the agency manages.
 */
export async function sendRenewalReminderNow(ownerUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Tu sesión venció. Vuelve a entrar." };
  if (!(await isAgencyAdmin(session.user.id))) return { ok: false, error: "Solo la agencia puede enviar recordatorios." };

  const managed = await prisma.membership.findMany({ where: { userId: session.user.id, role: "ADMIN" }, select: { businessId: true } });
  const owns = await prisma.membership.findFirst({
    where: { userId: ownerUserId, role: "OWNER", businessId: { in: managed.map((m) => m.businessId) } },
    select: { id: true },
  });
  if (!owns) return { ok: false, error: "Esa cuenta no es de tus clientes." };

  // A client can't be flooded from here either.
  const limitKey = `renewal-remind:${ownerUserId}`;
  if (await isRateLimited(limitKey, 3, 24 * 60 * 60_000)) return { ok: false, error: "Ya le enviaste varios recordatorios hoy." };

  const ctx = await renewalContext(ownerUserId);
  if (!ctx) return { ok: false, error: "Esa cuenta no tiene negocios." };
  await recordRateLimitEvent(limitKey);
  const sent = await sendRenewalReminder(ownerUserId, (ctx.endsAt && reminderKindFor(ctx.endsAt, new Date())) || "d5");
  return sent ? { ok: true } : { ok: false, error: "No se pudo enviar el correo. Inténtalo de nuevo." };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * "Renovar" on the expired-plan screen: sends the account's owner to Mercado
 * Pago, either to start a monthly subscription that renews itself ("card") or
 * to pay one month once ("month", which also takes PSE and Nequi). Access
 * comes back when Mercado Pago confirms it (return page or webhook).
 */
export async function startRenewal(kind: "card" | "month"): Promise<RenewalState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Each click asks Mercado Pago for a link: keep a stuck button from hammering it.
  const limitKey = `renewal:${userId}`;
  if (await isRateLimited(limitKey, 10, 10 * 60_000)) return { error: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo." };
  await recordRateLimitEvent(limitKey);

  const ctx = await renewalContext(userId);
  if (!ctx) return { error: "Solo el dueño de la cuenta puede renovar. Avísale para que lo haga." };

  let failure = "";
  if (kind === "card") {
    const plan = await renewalPlanCheckout(ctx.planTier, ctx.priceCop);
    if ("initPoint" in plan) redirect(plan.initPoint);
    failure = plan.error;
  } else {
    const link = await oneMonthCheckout(ctx);
    if (link) redirect(link);
    failure = "no se pudo crear el enlace de pago";
  }

  console.error("Renewal checkout unavailable for", userId, kind, failure);
  const agency = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (agency) {
    await sendEmail({
      to: agency,
      subject: "No se pudo abrir Mercado Pago para una renovación",
      html: `<p>${esc(ctx.email)} intentó renovar (${kind === "card" ? "con tarjeta, cobro mensual" : "un mes"}) y Mercado Pago respondió con error.</p><p>Detalle: ${esc(failure)}</p>`,
    }).catch(() => {});
  }
  return { error: "Mercado Pago no respondió. Ya avisamos al equipo; inténtalo de nuevo en un momento o escríbenos por WhatsApp." };
}
