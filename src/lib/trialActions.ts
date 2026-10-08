"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createMpAccountSubscription } from "@/lib/mercadopago";
import { PLAN_LABELS, PLAN_PRICE_COP, TRIAL_DAYS, TRIAL_PLAN } from "@/lib/plans";
import { appHost, trialPlanCheckout } from "@/lib/trial";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type TrialCheckoutState = { error: string | null; detail?: string };

/**
 * "Activa tu prueba gratis": sends the signed-in account to Mercado Pago to
 * register a card for the Starter free trial. Tries, in order, the app's
 * trial plan, a subscription made for this account, and a plan link set by
 * hand in the environment. The account is activated when the subscription
 * is authorized (return page or webhook, see lib/trial.ts).
 */
export async function startTrialCheckout(): Promise<TrialCheckoutState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, activationRequired: true } });
  if (!user) redirect("/login");
  if (!user.activationRequired) redirect("/dashboard");

  await prisma.user.update({ where: { id: session.user.id }, data: { trialCheckoutAt: new Date() } });

  const errors: string[] = [];
  const plan = await trialPlanCheckout();
  if ("initPoint" in plan) redirect(plan.initPoint);
  errors.push(`plan: ${plan.error}`);

  const sub = await createMpAccountSubscription({
    reason: `Funnels Labs ${PLAN_LABELS[TRIAL_PLAN]}`,
    amountCop: PLAN_PRICE_COP[TRIAL_PLAN],
    trialDays: TRIAL_DAYS,
    payerEmail: user.email,
    externalReference: `user:${session.user.id}`,
    backUrl: `https://${appHost()}/activar?estado=listo`,
  });
  if ("initPoint" in sub) redirect(sub.initPoint);
  errors.push(`suscripción: ${sub.error}`);

  const manualLink = process.env[`MP_PLAN_LINK_${TRIAL_PLAN}`];
  if (manualLink) redirect(manualLink);

  console.error("Trial checkout unavailable for", session.user.id, errors.join(" | "));
  const agency = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (agency) {
    await sendEmail({
      to: agency,
      subject: "No se pudo abrir Mercado Pago para una prueba gratis",
      html: `<p>${esc(user.email)} intentó registrar su tarjeta y Mercado Pago respondió con error.</p><p>Detalle: ${errors.map(esc).join("<br>")}</p>`,
    }).catch(() => {});
  }
  return {
    error: "Mercado Pago no respondió como esperábamos. Ya avisamos al equipo; vuelve a intentarlo o escríbenos por WhatsApp y te activamos en minutos.",
    detail: errors.join(" · "),
  };
}
