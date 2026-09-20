import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PIPELINE_STAGE_NAMES } from "@/lib/crmStages";
import { sendEmail } from "@/lib/email";

// Longer than the "forgot password" reset link (1h, see RESET_TOKEN_TTL_MS
// in actions.ts) because a customer may not open the welcome email right
// after paying — give them a week before they'd need to request a new one
// via "forgot password" instead.
const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function sanitizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export type ProvisionResult =
  | { status: "created"; businessId: string }
  | { status: "already_exists"; businessId: string }
  | { status: "error"; message: string };

/**
 * Creates a client's account right after a Hotmart purchase clears — see
 * src/app/api/webhooks/hotmart/route.ts. No password is ever set to a known
 * value: instead we mint the same kind of one-time token requestPasswordReset
 * uses (in actions.ts) and email the client a link to /reset-password to
 * choose their own password and log in for the first time.
 */
export async function provisionClientFromPurchase(input: {
  businessName: string;
  email: string;
  phone: string;
  industry?: string;
}): Promise<ProvisionResult> {
  const email = input.email.trim().toLowerCase();
  const businessName = input.businessName.trim() || "Mi negocio";
  const phone = sanitizePhone(input.phone);
  const industry = input.industry ?? "otro";

  if (!email) return { status: "error", message: "Missing buyer email" };

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { select: { businessId: true }, take: 1 } },
  });

  // A repeat customer (renewal, or buying a second line) already has a
  // login — don't create a duplicate account. This only covers the "same
  // email already has an account" case; provisioning a second business for
  // an existing client from a purchase is not handled yet (agency can still
  // do it manually from "+ Crear cliente").
  if (existing) {
    return { status: "already_exists", businessId: existing.memberships[0]?.businessId ?? "" };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  // Never told to anyone — the account is only ever accessed by setting a
  // real password through the activation link below.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);

  const agencyAdminEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();

  const businessId = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: businessName,
        slug: `${slugify(businessName)}-${Math.random().toString(36).slice(2, 7)}`,
        industry,
        subscriptionStartedAt: new Date(),
        agent: { create: { systemPrompt: "" } },
      },
    });

    await tx.pipeline.create({
      data: {
        businessId: business.id,
        name: "Embudo principal",
        position: 0,
        isDefault: true,
        stages: {
          create: DEFAULT_PIPELINE_STAGE_NAMES.map((stageName, position) => ({
            businessId: business.id,
            name: stageName,
            position,
          })),
        },
      },
    });

    await tx.user.create({
      data: {
        email,
        phone,
        passwordHash,
        name: businessName,
        resetTokenHash,
        resetTokenExpiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
        memberships: { create: { role: "OWNER", businessId: business.id } },
      },
    });

    if (agencyAdminEmail) {
      const admin = await tx.user.findUnique({ where: { email: agencyAdminEmail } });
      if (admin) {
        await tx.membership.create({
          data: { userId: admin.id, businessId: business.id, role: "ADMIN" },
        });
      }
    }

    return business.id;
  });

  const activationUrl = `https://${process.env.APP_HOST ?? "funnelslabs.app"}/reset-password?token=${rawToken}`;

  await sendEmail({
    to: email,
    subject: "Tu cuenta de Funnels Labs ya está lista",
    html: `
      <p>¡Gracias por tu compra! Tu cuenta de Funnels Labs ya está creada.</p>
      <p><a href="${activationUrl}">Haz clic aquí para elegir tu contraseña e iniciar sesión</a></p>
      <p>Este enlace vence en 7 días. Si tienes algún problema, escríbenos por WhatsApp.</p>
    `,
  });

  return { status: "created", businessId };
}
