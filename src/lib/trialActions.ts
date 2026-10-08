"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createMpTrialSubscription } from "@/lib/mercadopago";
import { PLAN_LABELS, PLAN_PRICE_COP, TRIAL_DAYS } from "@/lib/plans";

export type TrialCheckoutState = { error: string | null };

/**
 * "Activa tu prueba gratis": creates the Mercado Pago subscription (with the
 * free trial) for the signed-in account and sends the person to Mercado
 * Pago to register their card. The webhook activates the account when they
 * authorize it (see lib/payments.ts).
 */
export async function startTrialCheckout(_prev: TrialCheckoutState, formData: FormData): Promise<TrialCheckoutState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const plan = formData.get("plan") === "PRO" ? "PRO" : "STARTER";

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, activationRequired: true } });
  if (!user) redirect("/login");
  if (!user.activationRequired) redirect("/dashboard");

  // Pro and Scale accounts are set up with the team; plan links from env
  // let the agency use subscription plans created in Mercado Pago instead.
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  const result = await createMpTrialSubscription({
    reason: `Funnels Labs ${PLAN_LABELS[plan]}`,
    amountCop: PLAN_PRICE_COP[plan],
    trialDays: TRIAL_DAYS,
    payerEmail: user.email,
    externalReference: `user:${session.user.id}`,
    backUrl: `https://${host}/activar?estado=listo`,
  });
  if ("initPoint" in result) redirect(result.initPoint);

  const fallback = process.env[`MP_PLAN_LINK_${plan}`];
  if (fallback) redirect(fallback);
  return { error: "No pudimos abrir Mercado Pago en este momento. Intenta de nuevo en un minuto o escríbenos por WhatsApp." };
}
