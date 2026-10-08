"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelMpPreapproval, fetchMpPreapproval } from "@/lib/mercadopago";
import { sendEmail } from "@/lib/email";

/**
 * The client cancels their own Mercado Pago subscription from Mi perfil: no
 * more charges. They keep access until the period already covered (the
 * trial or the month paid) ends, and their data stays for when they return.
 */
export async function cancelMySubscription(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, mpPreapprovalId: true },
  });
  if (!user?.mpPreapprovalId) return { ok: false, error: "No encontramos una suscripción de Mercado Pago en tu cuenta." };

  const sub = await fetchMpPreapproval(user.mpPreapprovalId);
  if (!sub) return { ok: false, error: "No pudimos consultar tu suscripción en Mercado Pago. Inténtalo en un momento." };
  if (sub.status !== "cancelled") {
    const res = await cancelMpPreapproval(sub.id);
    if ("error" in res) return { ok: false, error: "Mercado Pago no permitió cancelarla ahora. Inténtalo en un momento o escríbenos por WhatsApp." };
  }

  const agency = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (agency) {
    await sendEmail({
      to: agency,
      subject: `Canceló su suscripción: ${user.name || user.email}`,
      html: `<p><b>${user.name || user.email}</b> (${user.email}) canceló su suscripción de Mercado Pago (${sub.id}) desde Mi perfil. No se le volverá a cobrar; conserva el acceso hasta que termine el período ya cubierto.</p>`,
    }).catch(() => {});
  }

  revalidatePath("/dashboard/account");
  return { ok: true };
}
