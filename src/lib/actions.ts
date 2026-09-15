"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { requireBusinessMembership } from "@/lib/authz";
import { AGENT_PROMPT_TEMPLATE } from "@/lib/promptTemplate";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { DEFAULT_PIPELINE_STAGE_NAMES } from "@/lib/crmStages";
import { generateSalesDiagnosis as runSalesDiagnosis, type SalesDiagnosis } from "@/lib/diagnosis";
import { PLAN_TIERS } from "@/lib/plans";
import { logRegistrationForRemarketing } from "@/lib/remarketingSheet";
import { sendEmail } from "@/lib/email";
import type { PlanTier } from "@prisma/client";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Meta access tokens and phone number IDs are always plain ASCII. Stripping
 * anything else defends against a stray character from a bad copy/paste
 * silently corrupting the value — which otherwise only surfaces later as a
 * cryptic "ByteString" crash when the token is used in an HTTP header.
 */
function sanitizeAsciiToken(value: string): string {
  return value.replace(/[^\x21-\x7E]/g, "");
}

/** Keeps a leading "+" and digits only, so the number stays usable for a wa.me link later. */
function sanitizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export type RegisterState = { error: string | null };

/**
 * Public self-registration: a new client creates their own login and their
 * first business in one step. WhatsApp credentials are deliberately not
 * collected here — a brand-new client rarely has their Meta access token
 * handy at signup time, so that gets filled in afterward from the business
 * page (with Funnels Labs walking them through it on the onboarding call).
 */
export async function registerBusiness(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = sanitizePhone(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");
  const industry = String(formData.get("industry") ?? "otro");

  if (!name || !email || !phone || !password) {
    return { error: "Completa todos los campos" };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con ese correo" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const industryLabel = INDUSTRY_OPTIONS.find((option) => option.value === industry)?.label ?? "negocio";
  // Pre-fill the name and industry we already know; the rest of the
  // template's [placeholders] stay for the client to fill in later from
  // their business page (same template used in "+ Nuevo negocio").
  const defaultSystemPrompt = AGENT_PROMPT_TEMPLATE
    .replace(/\[NOMBRE DEL NEGOCIO\]/g, name)
    .replace("[TIPO DE NEGOCIO: ej. clínica dental, tienda de ropa, estudio de coaching, restaurante]", industryLabel);

  // AGENCY_ADMIN_EMAIL (optional): if set to Funnels Labs' own account,
  // every new client business also gets that account as an ADMIN member —
  // so the agency sees every client from its own dashboard instead of
  // needing a separate login (or a manual DB edit) per client.
  const agencyAdminEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();

  await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name,
        slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
        industry,
        agent: { create: { systemPrompt: defaultSystemPrompt } },
        pipelineStages: {
          create: DEFAULT_PIPELINE_STAGE_NAMES.map((stageName, position) => ({
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
        name,
        memberships: { create: { role: "OWNER", businessId: business.id } },
      },
    });

    if (agencyAdminEmail && agencyAdminEmail !== email) {
      const admin = await tx.user.findUnique({ where: { email: agencyAdminEmail } });
      if (admin) {
        await tx.membership.create({
          data: { userId: admin.id, businessId: business.id, role: "ADMIN" },
        });
      }
    }
  });

  await logRegistrationForRemarketing({
    nombre: name,
    correo: email,
    telefono: phone,
    negocio: name,
    industria: industryLabel,
  });

  redirect("/login?registered=1");
}

export async function createBusiness(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = String(formData.get("name") ?? "").trim();
  const wabaPhoneNumberId = sanitizeAsciiToken(String(formData.get("wabaPhoneNumberId") ?? ""));
  const wabaAccessToken = sanitizeAsciiToken(String(formData.get("wabaAccessToken") ?? ""));
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();
  const industry = String(formData.get("industry") ?? "otro");

  if (!name || !wabaPhoneNumberId || !wabaAccessToken || !systemPrompt) {
    throw new Error("Missing required fields");
  }

  const business = await prisma.business.create({
    data: {
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      wabaPhoneNumberId,
      wabaAccessToken: encryptSecret(wabaAccessToken),
      industry,
      memberships: { create: { userId: session.user.id, role: "OWNER" } },
      agent: { create: { systemPrompt } },
      pipelineStages: {
        create: DEFAULT_PIPELINE_STAGE_NAMES.map((stageName, position) => ({
          name: stageName,
          position,
        })),
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/businesses/${business.id}`);
}

export async function updateWabaCredentials(businessId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const wabaPhoneNumberId = sanitizeAsciiToken(String(formData.get("wabaPhoneNumberId") ?? ""));
  const wabaAccessToken = sanitizeAsciiToken(String(formData.get("wabaAccessToken") ?? ""));

  if (!wabaPhoneNumberId) {
    throw new Error("Missing required fields");
  }

  // The token field is optional here: it only needs to be filled in when the
  // previous one expired. An empty submission just keeps the stored token.
  await prisma.business.update({
    where: { id: businessId },
    data: {
      wabaPhoneNumberId,
      ...(wabaAccessToken ? { wabaAccessToken: encryptSecret(wabaAccessToken) } : {}),
    },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function updateAgent(businessId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();
  const tone = String(formData.get("tone") ?? "cercano");
  const replyLength = String(formData.get("replyLength") ?? "breve");
  const industry = String(formData.get("industry") ?? "otro");

  if (!systemPrompt) throw new Error("systemPrompt is required");

  await prisma.$transaction([
    prisma.aIAgent.update({
      where: { businessId },
      data: { systemPrompt, tone, replyLength },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { industry },
    }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function updateConversationStage(
  businessId: string,
  conversationId: string,
  stageId: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, businessId } });
  if (!stage) throw new Error("Invalid stage");

  await prisma.conversation.update({
    where: { id: conversationId, businessId },
    data: { stageId },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
  revalidatePath(`/dashboard/businesses/${businessId}/conversations/${conversationId}`);
}

export async function addPipelineStage(businessId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("name is required");

  const last = await prisma.pipelineStage.findFirst({
    where: { businessId },
    orderBy: { position: "desc" },
  });

  await prisma.pipelineStage.create({
    data: { businessId, name, position: (last?.position ?? -1) + 1 },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function renamePipelineStage(
  businessId: string,
  stageId: string,
  name: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("name is required");

  await prisma.pipelineStage.update({
    where: { id: stageId, businessId },
    data: { name: trimmed },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function deletePipelineStage(businessId: string, stageId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const stages = await prisma.pipelineStage.findMany({
    where: { businessId },
    orderBy: { position: "asc" },
  });

  if (stages.length <= 1) {
    throw new Error("A business must keep at least one pipeline stage");
  }

  const toDelete = stages.find((s) => s.id === stageId);
  if (!toDelete) throw new Error("Invalid stage");

  // Conversations sitting in the deleted stage move to the first remaining
  // one instead of being blocked or silently orphaned.
  const fallback = stages.find((s) => s.id !== stageId)!;

  await prisma.$transaction([
    prisma.conversation.updateMany({
      where: { businessId, stageId },
      data: { stageId: fallback.id },
    }),
    prisma.pipelineStage.delete({ where: { id: stageId } }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function movePipelineStage(
  businessId: string,
  stageId: string,
  direction: "left" | "right",
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const stages = await prisma.pipelineStage.findMany({
    where: { businessId },
    orderBy: { position: "asc" },
  });

  const index = stages.findIndex((s) => s.id === stageId);
  const swapWith = direction === "left" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= stages.length) return;

  const a = stages[index];
  const b = stages[swapWith];

  await prisma.$transaction([
    // Bump `a` out of the way first so the (businessId, position) unique
    // constraint doesn't collide with `b` while swapping.
    prisma.pipelineStage.update({ where: { id: a.id }, data: { position: -1 } }),
    prisma.pipelineStage.update({ where: { id: b.id }, data: { position: a.position } }),
    prisma.pipelineStage.update({ where: { id: a.id }, data: { position: b.position } }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function toggleAgentEnabled(businessId: string, enabled: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  await prisma.aIAgent.update({ where: { businessId }, data: { enabled } });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function toggleConversationAiPaused(
  businessId: string,
  conversationId: string,
  aiPaused: boolean,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  await prisma.conversation.update({
    where: { id: conversationId, businessId },
    data: { aiPaused },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
  revalidatePath(`/dashboard/businesses/${businessId}/conversations/${conversationId}`);
}

export async function sendManualMessage(
  businessId: string,
  conversationId: string,
  formData: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const text = String(formData.get("text") ?? "").trim();
  if (!text) throw new Error("text is required");

  const [business, conversation] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.conversation.findFirstOrThrow({ where: { id: conversationId, businessId } }),
  ]);

  if (!business.wabaAccessToken || !business.wabaPhoneNumberId) {
    throw new Error("This business has no WhatsApp credentials configured");
  }

  const { messageId } = await sendWhatsAppTextMessage({
    phoneNumberId: business.wabaPhoneNumberId,
    accessToken: decryptSecret(business.wabaAccessToken),
    to: conversation.customerPhone,
    text,
  });

  await prisma.message.create({
    data: {
      conversationId,
      role: "AGENT",
      content: text,
      whatsappMsgId: messageId,
      sentByHuman: true,
    },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/conversations/${conversationId}`);
}

export type SalesDiagnosisResult =
  | { status: "insufficient_data" }
  | { status: "ok"; diagnosis: SalesDiagnosis; generatedAt: string }
  | { status: "error"; message: string };

export async function generateSalesDiagnosis(businessId: string): Promise<SalesDiagnosisResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  let result;
  try {
    result = await runSalesDiagnosis(businessId);
  } catch {
    // Claude/API failures land here — surfaced as a plain message in the UI
    // rather than crashing the whole analytics page.
    return { status: "error", message: "No se pudo generar el diagnóstico. Intenta de nuevo en un momento." };
  }

  if (result.status === "insufficient_data") {
    return { status: "insufficient_data" };
  }

  const generatedAt = new Date();
  await prisma.aIAgent.update({
    where: { businessId },
    data: { diagnosisReport: result.diagnosis, diagnosisGeneratedAt: generatedAt },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/analytics`);
  return { status: "ok", diagnosis: result.diagnosis, generatedAt: generatedAt.toISOString() };
}

// Plan tier is a billing decision, assigned by the agency after a sales call
// — the client (Role.OWNER) can see their usage against it but never change
// it themselves, so this checks the membership role directly rather than
// just requireBusinessMembership.
export async function updateBusinessPlan(businessId: string, planTier: PlanTier): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new Error("Only the agency can change a business's plan");
  }
  if (!PLAN_TIERS.includes(planTier)) {
    throw new Error("Invalid plan tier");
  }

  await prisma.business.update({ where: { id: businessId }, data: { planTier } });
  revalidatePath(`/dashboard/businesses/${businessId}`);
  revalidatePath("/dashboard");
}

export async function updateBusinessName(businessId: string, name: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new Error("Only the agency can rename a business");
  }

  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");

  await prisma.business.update({ where: { id: businessId }, data: { name: trimmed } });
  revalidatePath(`/dashboard/businesses/${businessId}`);
  revalidatePath("/dashboard");
}

export type ForgotPasswordState = { submitted: boolean };

/**
 * Always returns { submitted: true } whether or not the email is
 * registered — revealing that would let anyone probe for which emails
 * have an account.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });

      const host = (await headers()).get("host");
      const resetUrl = `https://${host}/reset-password?token=${rawToken}`;

      await sendEmail({
        to: email,
        subject: "Restablece tu contraseña — Funnels Labs",
        html: `
          <p>Recibimos una solicitud para restablecer tu contraseña en Funnels Labs.</p>
          <p><a href="${resetUrl}">Haz clic aquí para elegir una nueva contraseña</a></p>
          <p>Este enlace vence en 1 hora. Si tú no pediste esto, ignora este correo — tu contraseña sigue igual.</p>
        `,
      });
    }
  }

  return { submitted: true };
}

export type ResetPasswordState = { error: string | null };

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "Enlace inválido. Solicita uno nuevo." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };

  const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({
    where: { resetTokenHash, resetTokenExpiresAt: { gt: new Date() } },
  });

  if (!user) {
    return { error: "El enlace venció o ya se usó. Solicita uno nuevo." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  });

  redirect("/login?reset=1");
}

export type UpdateProfileState = { error: string | null; saved: boolean };

export async function updateOwnProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre no puede estar vacío", saved: false };

  const phone = sanitizePhone(String(formData.get("phone") ?? ""));
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const socialMedia = String(formData.get("socialMedia") ?? "").trim();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone: phone || null,
      city: city || null,
      country: country || null,
      socialMedia: socialMedia || null,
    },
  });
  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  return { error: null, saved: true };
}

/**
 * Lets the agency set a new password for a client directly — a reliable
 * fallback to "forgot password" when email delivery is unavailable (e.g.
 * GOOGLE_APPS_SCRIPT_WEBHOOK_URL not configured yet, or the client just
 * can't find the email). Returns the new plaintext password once, for the
 * agency to hand to the client directly (WhatsApp, phone); it is never
 * stored anywhere except as a bcrypt hash.
 */
export async function adminResetUserPassword(targetUserId: string): Promise<{ password: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const targetOwnerBusinessIds = (
    await prisma.membership.findMany({
      where: { userId: targetUserId, role: "OWNER" },
      select: { businessId: true },
    })
  ).map((m) => m.businessId);

  const callerIsAdmin = await prisma.membership.findFirst({
    where: { userId: session.user.id, role: "ADMIN", businessId: { in: targetOwnerBusinessIds } },
  });
  if (!callerIsAdmin) {
    throw new Error("Only the agency can reset a client's password");
  }

  const newPassword = crypto.randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  });

  return { password: newPassword };
}
