import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { cancelMpPreapproval, fetchMpPreapproval } from "@/lib/mercadopago";
import { isAgencyAdmin } from "@/lib/authz";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/htmlEscape";

// "Eliminar mi cuenta": the person deletes their own account and its data. Both
// app stores require it, in the app and on a public page.
//
// What goes: the account, every business they own alone (with its conversations,
// contacts, flows, pages…) and their membership in any other business. Their
// Mercado Pago subscription is cancelled first: if that cannot be done, nothing
// is deleted, so nobody keeps being charged for an account that no longer exists.
// The agency's own account cannot be deleted from here.

const ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

export async function deleteAccount(userId: string, password: string): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, passwordHash: true, mpPreapprovalId: true, memberships: { select: { businessId: true, role: true } } },
  });
  if (!user) return { ok: false, error: "No encontramos tu cuenta." };
  if (await isAgencyAdmin(userId)) return { ok: false, error: "La cuenta de la agencia no se puede eliminar desde aquí. Escríbenos por WhatsApp." };

  // The password is asked again: a stolen open session must not be able to wipe an account.
  const key = `delete-account:${userId}`;
  if (await isRateLimited(key, ATTEMPTS, WINDOW_MS)) return { ok: false, error: "Demasiados intentos. Espera una hora e inténtalo de nuevo." };
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await recordRateLimitEvent(key);
    return { ok: false, error: "La contraseña no es correcta." };
  }

  if (user.mpPreapprovalId) {
    const sub = await fetchMpPreapproval(user.mpPreapprovalId);
    if (!sub) return { ok: false, error: "No pudimos revisar tu suscripción en Mercado Pago. Inténtalo en un momento: no borramos nada para que no te sigan cobrando." };
    if (sub.status !== "cancelled") {
      const res = await cancelMpPreapproval(sub.id);
      if ("error" in res) return { ok: false, error: "Mercado Pago no permitió cancelar tu suscripción ahora. Inténtalo en un momento o escríbenos por WhatsApp." };
    }
  }

  // A business with another owner stays with them (it goes away from this person's side
  // when the account is deleted, because memberships cascade); the rest are deleted.
  const ownedBusinessIds = user.memberships.filter((m) => m.role === "OWNER").map((m) => m.businessId);
  for (const businessId of ownedBusinessIds) {
    const otherOwners = await prisma.membership.count({ where: { businessId, role: "OWNER", userId: { not: userId } } });
    if (otherOwners === 0) await prisma.business.delete({ where: { id: businessId } });
  }
  await prisma.user.delete({ where: { id: userId } });

  const agency = process.env.AGENCY_ADMIN_EMAIL?.trim();
  if (agency) {
    await sendEmail({
      to: agency,
      subject: `Eliminó su cuenta: ${user.name || user.email}`,
      html: `<p><b>${escapeHtml(user.name || user.email)}</b> (${escapeHtml(user.email)}) eliminó su cuenta desde Mi perfil. Se borraron sus datos${ownedBusinessIds.length ? ` y ${ownedBusinessIds.length === 1 ? "su negocio" : "sus negocios"}` : ""}${user.mpPreapprovalId ? ", y se canceló su suscripción de Mercado Pago" : ""}.</p>`,
    }).catch(() => {});
  }
  return { ok: true };
}
