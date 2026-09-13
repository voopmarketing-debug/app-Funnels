"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { requireBusinessMembership } from "@/lib/authz";
import type { ConversationStage } from "@prisma/client";

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
  const password = String(formData.get("password") ?? "");
  const industry = String(formData.get("industry") ?? "otro");

  if (!name || !email || !password) {
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
  const defaultSystemPrompt = `Eres el asistente de WhatsApp de ${name}. Responde de forma breve, cercana y amable. Resuelve las dudas del cliente y ayúdalo a avanzar (agendar, comprar, o lo que corresponda al negocio). Si no sabes algo, dilo con honestidad en vez de inventar información.`;

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      memberships: {
        create: {
          role: "OWNER",
          business: {
            create: {
              name,
              slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
              industry,
              agent: { create: { systemPrompt: defaultSystemPrompt } },
            },
          },
        },
      },
    },
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
  const temperature = Number(formData.get("temperature") ?? 0.7);
  const enabled = formData.get("enabled") === "on";
  const tone = String(formData.get("tone") ?? "cercano");
  const replyLength = String(formData.get("replyLength") ?? "breve");
  const industry = String(formData.get("industry") ?? "otro");

  if (!systemPrompt) throw new Error("systemPrompt is required");

  await prisma.$transaction([
    prisma.aIAgent.update({
      where: { businessId },
      data: { systemPrompt, temperature, enabled, tone, replyLength },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { industry },
    }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

const VALID_STAGES: ConversationStage[] = ["NUEVO", "EN_CONVERSACION", "INTERESADO", "GANADO", "PERDIDO"];

export async function updateConversationStage(
  businessId: string,
  conversationId: string,
  stage: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  if (!VALID_STAGES.includes(stage as ConversationStage)) {
    throw new Error("Invalid stage");
  }

  await prisma.conversation.update({
    where: { id: conversationId, businessId },
    data: { stage: stage as ConversationStage },
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
