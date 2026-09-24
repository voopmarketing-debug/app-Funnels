"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import {
  sendWhatsAppTextMessage,
  sendWhatsAppMediaMessage,
  sendWhatsAppTemplateMessage,
  createWhatsAppTemplate,
  fetchWhatsAppTemplateStatus,
  fetchWhatsAppDisplayNumber,
  verifyWabaConnection,
  uploadTemplateHeaderImage,
  type TemplateButton,
} from "@/lib/whatsapp";
import { generateWebsiteContent, applyWebsiteEdit } from "@/lib/websiteGenerator";
import { generateHeroImage } from "@/lib/websiteHeroImage";
import { assertWebsiteGenerationAllowed, recordWebsiteGeneration } from "@/lib/websiteGenerationLimit";
import { WebsiteContentSchema, type WebsiteContent } from "@/lib/websiteContent";
import { AvailabilitySchema, DEFAULT_AVAILABILITY, type Availability } from "@/lib/agenda";
import {
  resolveMediaType,
  uploadAttachment,
  MAX_ATTACHMENT_BYTES,
  maxMbFor,
  MAX_AGENT_MEDIA_PER_BUSINESS,
} from "@/lib/attachments";
import { convertToOggOpus } from "@/lib/audioConvert";
import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { requireBusinessMembership, requireBusinessOwnerOrAdmin } from "@/lib/authz";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { DEFAULT_PIPELINE_STAGE_NAMES } from "@/lib/crmStages";
import { generateSalesDiagnosis as runSalesDiagnosis, type SalesDiagnosis } from "@/lib/diagnosis";
import { PLAN_TIERS, PLAN_LABELS, TEAM_MEMBER_LIMITS } from "@/lib/plans";
import { getAccountLineStatus } from "@/lib/lineLimits";
import { logRegistrationForRemarketing } from "@/lib/remarketingSheet";
import { sendEmail } from "@/lib/email";
import { Prisma, type PlanTier } from "@prisma/client";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_REQUEST_MAX = 3;
const RESET_REQUEST_WINDOW_MS = 15 * 60 * 1000;

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

  const passwordHash = await bcrypt.hash(password, 12);
  const industryLabel = INDUSTRY_OPTIONS.find((option) => option.value === industry)?.label ?? "negocio";

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
        agent: { create: { systemPrompt: "" } },
      },
    });

    // Every business starts with one default pipeline (funnel) — a team can
    // later add more, e.g. one per salesperson, from the CRM (see
    // createPipeline below).
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

export type CreateClientState = {
  error: string | null;
  success: { password: string; businessId: string; businessName: string } | null;
};

/**
 * Agency-only: creates a brand-new client account + their first business in
 * one step, for when the agency itself onboards a client (a sales call, a
 * favor, a migration) instead of the client self-registering. Deliberately
 * has NO line-limit check — unlike createBusiness below, this always makes
 * a fresh client account (never the caller's own), so there is nothing of
 * the caller's to cap, and a brand-new client always starts at zero anyway.
 * The password is generated the same way as adminResetUserPassword: shown
 * once here so the agency can hand it to the client directly.
 */
export async function createClientAccount(
  _prevState: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const isAgencyAdmin = await prisma.membership.findFirst({
    where: { userId: session.user.id, role: "ADMIN" },
    select: { id: true },
  });
  if (!isAgencyAdmin) throw new Error("Solo la agencia puede crear cuentas de clientes");

  const businessName = String(formData.get("businessName") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = sanitizePhone(String(formData.get("phone") ?? ""));
  const industry = String(formData.get("industry") ?? "otro");

  if (!businessName || !clientName || !email || !phone) {
    return { error: "Completa todos los campos", success: null };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "Ya existe una cuenta con ese correo", success: null };
  }

  const newPassword = crypto.randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Same auto-grant as registerBusiness, so the agency's shared inbox also
  // sees this client even if a different admin account created it.
  const agencyAdminEmail = process.env.AGENCY_ADMIN_EMAIL?.trim().toLowerCase();
  const callerEmail = session.user.email?.trim().toLowerCase();

  const businessId = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: businessName,
        slug: `${slugify(businessName)}-${Math.random().toString(36).slice(2, 7)}`,
        industry,
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
        name: clientName,
        memberships: { create: { role: "OWNER", businessId: business.id } },
      },
    });

    await tx.membership.create({
      data: { userId: session.user.id, businessId: business.id, role: "ADMIN" },
    });

    if (agencyAdminEmail && agencyAdminEmail !== callerEmail) {
      const admin = await tx.user.findUnique({ where: { email: agencyAdminEmail } });
      if (admin) {
        await tx.membership.create({
          data: { userId: admin.id, businessId: business.id, role: "ADMIN" },
        });
      }
    }

    return business.id;
  });

  revalidatePath("/dashboard/clients");
  return { error: null, success: { password: newPassword, businessId, businessName } };
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

  const lineStatus = await getAccountLineStatus(session.user.id);
  if (lineStatus.atLimit) {
    throw new Error(
      `Alcanzaste el límite de líneas de WhatsApp de tu plan ${PLAN_LABELS[lineStatus.planTier]} (${lineStatus.limit}). Actualiza de plan o contáctanos para agregar más.`,
    );
  }

  let business;
  try {
    business = await prisma.business.create({
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
  } catch (err) {
    // Same @unique wabaPhoneNumberId constraint as updateWabaCredentials —
    // a reused Meta test number (or a copy-pasted production one) can't
    // create a second business here either.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(
        "Ese Phone Number ID ya está conectado a otro negocio en la plataforma. Cada negocio necesita su propio número de WhatsApp — no se puede repetir el mismo Phone Number ID en dos negocios.",
      );
    }
    throw err;
  }

  await prisma.pipeline.create({
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

  revalidatePath("/dashboard");
  redirect(`/dashboard/businesses/${business.id}`);
}

export type UpdateWabaCredentialsResult =
  | { verified: true; displayPhoneNumber: string | null }
  | { verified: false; verifyError: string };

export async function updateWabaCredentials(
  businessId: string,
  formData: FormData,
): Promise<UpdateWabaCredentialsResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  const wabaPhoneNumberId = sanitizeAsciiToken(String(formData.get("wabaPhoneNumberId") ?? ""));
  const wabaAccessToken = sanitizeAsciiToken(String(formData.get("wabaAccessToken") ?? ""));
  const wabaId = sanitizeAsciiToken(String(formData.get("wabaId") ?? ""));

  if (!wabaPhoneNumberId) {
    throw new Error("Missing required fields");
  }

  // The token field is optional here: it only needs to be filled in when the
  // previous one expired. An empty submission just keeps the stored token.
  // wabaId is optional too — only needed to create WhatsApp message
  // templates (see /templates), not for regular sending/receiving.
  try {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        wabaPhoneNumberId,
        ...(wabaAccessToken ? { wabaAccessToken: encryptSecret(wabaAccessToken) } : {}),
        ...(wabaId ? { wabaId } : {}),
      },
    });
  } catch (err) {
    // wabaPhoneNumberId is @unique — it's how the WhatsApp webhook routes an
    // incoming message to the right business. Two businesses can never share
    // one (including two Meta test numbers copy-pasted from the same
    // developer app): the second save must fail loudly instead of silently
    // stealing the first business's WhatsApp line.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(
        "Ese Phone Number ID ya está conectado a otro negocio en la plataforma. Cada negocio necesita su propio número de WhatsApp — no se puede repetir el mismo Phone Number ID en dos negocios.",
      );
    }
    throw err;
  }

  revalidatePath(`/dashboard/businesses/${businessId}`);

  // Saving to our DB always "succeeds" even with a wrong id or an expired
  // token — the only way to know it actually works is to ask Meta directly,
  // with the exact same credentials the agent will use to send/receive.
  let tokenToVerify = wabaAccessToken;
  if (!tokenToVerify) {
    const stored = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { wabaAccessToken: true },
    });
    if (!stored.wabaAccessToken) {
      return {
        verified: false,
        verifyError: "Todavía no hay ningún token guardado — pega el token de acceso que te dio Meta.",
      };
    }
    tokenToVerify = decryptSecret(stored.wabaAccessToken);
  }
  const verification = await verifyWabaConnection({ phoneNumberId: wabaPhoneNumberId, accessToken: tokenToVerify });

  if (!verification.ok) {
    return { verified: false, verifyError: verification.error };
  }
  return { verified: true, displayPhoneNumber: verification.displayPhoneNumber };
}

const TEMPLATE_CATEGORIES = new Set(["MARKETING", "UTILITY"]);

/** Reads up to 2 CTA/URL buttons out of a template form (buttonNText/buttonNUrl pairs) — a slot only counts if both fields are filled. */
function parseTemplateButtons(formData: FormData): TemplateButton[] {
  const buttons: TemplateButton[] = [];
  for (const n of [1, 2] as const) {
    const text = String(formData.get(`button${n}Text`) ?? "").trim();
    const url = String(formData.get(`button${n}Url`) ?? "").trim();
    if (!text && !url) continue;
    if (!text || !url) throw new Error(`El botón ${n} necesita tanto el texto como el enlace`);
    if (!/^https?:\/\//i.test(url)) throw new Error(`El enlace del botón ${n} debe empezar con https://`);
    buttons.push({ type: "URL", text, url });
  }
  return buttons;
}

/** Submits a new WhatsApp message template to Meta for approval — see lib/whatsapp.ts for the API call itself. */
export async function createMessageTemplate(businessId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const name = String(formData.get("name") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)+/g, "");
  const language = String(formData.get("language") ?? "es");
  const categoryRaw = String(formData.get("category") ?? "MARKETING");
  const category = TEMPLATE_CATEGORIES.has(categoryRaw) ? (categoryRaw as "MARKETING" | "UTILITY") : "MARKETING";
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  const buttons = parseTemplateButtons(formData);

  if (!name || !bodyText) throw new Error("El nombre y el texto de la plantilla son obligatorios");

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!business.wabaAccessToken || !business.wabaId) {
    throw new Error("Falta el WABA ID en las credenciales de WhatsApp de este negocio (ver sección de credenciales)");
  }
  const accessToken = decryptSecret(business.wabaAccessToken);

  // The header image is optional — when present it needs two separate
  // uploads: one to our own storage (so the app can redisplay/reuse it when
  // sending later) and one to Meta's own Resumable Upload API, which hands
  // back the one-time "handle" Meta requires in a template's creation
  // request (a plain URL isn't accepted there, unlike when *sending*).
  const headerImageEntry = formData.get("headerImage");
  const headerImageFile = headerImageEntry instanceof File && headerImageEntry.size > 0 ? headerImageEntry : null;
  let headerImageUrl: string | null = null;
  let headerImageHandle: string | undefined;
  if (headerImageFile) {
    if (resolveMediaType(headerImageFile.type) !== "image") {
      throw new Error("El encabezado solo acepta imágenes (JPG o PNG)");
    }
    if (headerImageFile.size > MAX_ATTACHMENT_BYTES.image) {
      throw new Error(`La imagen del encabezado supera el máximo permitido (${maxMbFor("image")} MB)`);
    }
    const appId = process.env.META_APP_ID;
    if (!appId) {
      throw new Error("Falta configurar META_APP_ID en el servidor para poder subir imágenes de encabezado a Meta");
    }
    const bytes = Buffer.from(await headerImageFile.arrayBuffer());
    const [uploaded, metaUpload] = await Promise.all([
      uploadAttachment({ bytes, filename: headerImageFile.name, contentType: headerImageFile.type }),
      uploadTemplateHeaderImage({ appId, accessToken, bytes, contentType: headerImageFile.type }),
    ]);
    headerImageUrl = uploaded.url;
    headerImageHandle = metaUpload.handle;
  }

  const { id: metaTemplateId, status } = await createWhatsAppTemplate({
    wabaId: business.wabaId,
    accessToken,
    name,
    language,
    category,
    bodyText,
    headerImageHandle,
    buttons,
  });

  await prisma.messageTemplate.create({
    data: {
      businessId,
      name,
      language,
      category,
      bodyText,
      headerImageUrl,
      buttons: buttons.length > 0 ? buttons : undefined,
      metaTemplateId,
      status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "PENDING",
    },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/templates`);
}

/** Re-checks a template's approval status with Meta — there's no status-update webhook wired up, so this is a manual refresh. */
export async function refreshTemplateStatus(businessId: string, templateId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const [business, template] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.messageTemplate.findFirstOrThrow({ where: { id: templateId, businessId } }),
  ]);
  if (!business.wabaAccessToken || !business.wabaId) {
    throw new Error("Falta el WABA ID en las credenciales de WhatsApp de este negocio");
  }

  const result = await fetchWhatsAppTemplateStatus({
    wabaId: business.wabaId,
    accessToken: decryptSecret(business.wabaAccessToken),
    name: template.name,
  });
  if (!result) return;

  await prisma.messageTemplate.update({
    where: { id: templateId },
    data: {
      status: result.status === "APPROVED" ? "APPROVED" : result.status === "REJECTED" ? "REJECTED" : "PENDING",
      rejectionReason: result.rejectionReason,
    },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/templates`);
}

export async function updateAgent(businessId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

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

/** Updates the lead detail panel's freeform fields — each one is optional so a caller can patch just one. */
export async function updateConversationDetails(
  businessId: string,
  conversationId: string,
  data: {
    notes?: string | null;
    appointmentAt?: string | null; // ISO string, or null to clear
    appointmentNote?: string | null;
    tags?: string[];
  },
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  await prisma.conversation.update({
    where: { id: conversationId, businessId },
    data: {
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.appointmentAt !== undefined && {
        appointmentAt: data.appointmentAt ? new Date(data.appointmentAt) : null,
      }),
      ...(data.appointmentNote !== undefined && { appointmentNote: data.appointmentNote }),
      ...(data.tags !== undefined && { tags: data.tags }),
    },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
  revalidatePath(`/dashboard/businesses/${businessId}/conversations/${conversationId}`);
}

export type BroadcastResult = { totalRecipients: number; sentCount: number; failedCount: number };

/**
 * Sends one message to every conversation in a business, or just the ones in
 * one pipeline stage. Meta only allows a free-form message to a customer
 * within 24h of their last message to us — outside that window the send
 * fails for that one recipient instead of blocking the batch, which shows up
 * as part of `failedCount`.
 *
 * Runs inline (no queue), in small concurrent batches so a pipeline of a few
 * hundred contacts finishes in one request instead of one giant burst — for
 * very large pipelines a background job would be safer against serverless
 * timeouts, but there's no queue infra in this app yet (see the same
 * tradeoff noted on the inbound webhook in api/webhooks/whatsapp/route.ts).
 */
export async function sendBroadcast(businessId: string, formData: FormData): Promise<BroadcastResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const stageIdRaw = String(formData.get("stageId") ?? "");
  const stageId = stageIdRaw && stageIdRaw !== "all" ? stageIdRaw : null;
  const templateId = String(formData.get("templateId") ?? "").trim() || null;

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  if (!business.wabaAccessToken || !business.wabaPhoneNumberId) {
    throw new Error("This business has no WhatsApp credentials configured");
  }
  const accessToken = decryptSecret(business.wabaAccessToken);
  const phoneNumberId = business.wabaPhoneNumberId;

  // Two ways to send: a free-text message (only reaches contacts who wrote
  // in the last 24h — Meta rejects the rest) or an approved template
  // (works anytime, but its body is fixed — see /templates). Exactly one
  // of these resolves per call. An attached image/document is only offered
  // for the free-text path — a template's own image header (if any) is
  // carried on `template.headerImageUrl` instead.
  let message: string;
  let template: { name: string; language: string; headerImageUrl?: string } | null = null;
  let media: { url: string; type: "image" | "document"; filename?: string } | null = null;
  if (templateId) {
    const approvedTemplate = await prisma.messageTemplate.findFirst({
      where: { id: templateId, businessId, status: "APPROVED" },
    });
    if (!approvedTemplate) throw new Error("Plantilla no encontrada o todavía no está aprobada");
    message = approvedTemplate.bodyText;
    template = {
      name: approvedTemplate.name,
      language: approvedTemplate.language,
      headerImageUrl: approvedTemplate.headerImageUrl ?? undefined,
    };
  } else {
    message = String(formData.get("message") ?? "").trim();
    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
    if (!message && !file) throw new Error("message is required");

    if (file) {
      const mediaType = resolveMediaType(file.type);
      if (mediaType !== "image" && mediaType !== "document") {
        throw new Error("Solo se aceptan fotos o documentos (PDF) como adjunto de difusión");
      }
      if (file.size > MAX_ATTACHMENT_BYTES[mediaType]) {
        throw new Error(`El archivo supera el máximo permitido (${maxMbFor(mediaType)} MB)`);
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadAttachment({ bytes, filename: file.name, contentType: file.type });
      media = { url, type: mediaType, filename: file.name };
    }
  }

  const conversations = await prisma.conversation.findMany({
    where: { businessId, ...(stageId ? { stageId } : {}) },
    select: { id: true, customerPhone: true },
  });

  const broadcast = await prisma.broadcast.create({
    data: {
      businessId,
      stageId,
      message,
      mediaUrl: media?.url,
      mediaType: media?.type,
      mediaFilename: media?.filename,
      createdByUserId: session.user.id,
      totalRecipients: conversations.length,
    },
  });

  const resultLog: { conversationId: string; ok: boolean; error?: string }[] = [];
  let sentCount = 0;

  const BATCH_SIZE = 5;
  for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
    const batch = conversations.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map(async (conv) => {
        const { messageId } = template
          ? await sendWhatsAppTemplateMessage({
              phoneNumberId,
              accessToken,
              to: conv.customerPhone,
              templateName: template.name,
              language: template.language,
              headerImageUrl: template.headerImageUrl,
            })
          : media
            ? await sendWhatsAppMediaMessage({
                phoneNumberId,
                accessToken,
                to: conv.customerPhone,
                type: media.type,
                link: media.url,
                caption: message || undefined,
                filename: media.type === "document" ? media.filename : undefined,
              })
            : await sendWhatsAppTextMessage({ phoneNumberId, accessToken, to: conv.customerPhone, text: message });
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            role: "AGENT",
            content: message,
            whatsappMsgId: messageId,
            sentByHuman: true,
            ...(media && {
              mediaUrl: media.url,
              mediaType: media.type,
              mediaFilename: media.filename,
            }),
          },
        });
      }),
    );

    outcomes.forEach((outcome, idx) => {
      const conversationId = batch[idx].id;
      if (outcome.status === "fulfilled") {
        sentCount++;
        resultLog.push({ conversationId, ok: true });
      } else {
        resultLog.push({ conversationId, ok: false, error: String(outcome.reason).slice(0, 300) });
      }
    });
  }

  const failedCount = conversations.length - sentCount;

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { sentCount, failedCount, resultLog, completedAt: new Date() },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);

  return { totalRecipients: conversations.length, sentCount, failedCount };
}

// A business's own funnels (see the Pipeline model) — e.g. one per
// salesperson, all sharing the same WhatsApp number but each with their own
// board of leads. Every business keeps its original one, and can add more
// from here.
export async function createPipeline(businessId: string, formData: FormData): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Ponle un nombre al embudo");

  const last = await prisma.pipeline.findFirst({ where: { businessId }, orderBy: { position: "desc" } });

  const pipeline = await prisma.pipeline.create({
    data: {
      businessId,
      name,
      position: (last?.position ?? -1) + 1,
      stages: {
        create: DEFAULT_PIPELINE_STAGE_NAMES.map((stageName, position) => ({
          businessId,
          name: stageName,
          position,
        })),
      },
    },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
  return { id: pipeline.id };
}

export async function renamePipeline(businessId: string, pipelineId: string, name: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("name is required");

  await prisma.pipeline.update({ where: { id: pipelineId, businessId }, data: { name: trimmed } });

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
}

export async function deletePipeline(businessId: string, pipelineId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const pipelines = await prisma.pipeline.findMany({ where: { businessId }, orderBy: { position: "asc" } });
  if (pipelines.length <= 1) throw new Error("Debe quedar al menos un embudo");

  const toDelete = pipelines.find((p) => p.id === pipelineId);
  if (!toDelete) throw new Error("Invalid pipeline");

  // Never delete the default pipeline — it's where every new inbound
  // WhatsApp conversation lands (see lib/agent.ts) before a team member
  // claims it into their own funnel.
  if (toDelete.isDefault) throw new Error("No puedes borrar el embudo principal");

  const fallback = pipelines.find((p) => p.isDefault) ?? pipelines.find((p) => p.id !== pipelineId)!;
  const fallbackFirstStage = await prisma.pipelineStage.findFirstOrThrow({
    where: { pipelineId: fallback.id },
    orderBy: { position: "asc" },
  });

  await prisma.$transaction([
    // Conversations sitting anywhere in the deleted embudo move to the
    // fallback embudo's first stage instead of being blocked or orphaned.
    prisma.conversation.updateMany({
      where: { businessId, stage: { pipelineId } },
      data: { stageId: fallbackFirstStage.id },
    }),
    prisma.pipeline.delete({ where: { id: pipelineId } }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
}

export async function addPipelineStage(businessId: string, pipelineId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("name is required");

  const last = await prisma.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { position: "desc" },
  });

  await prisma.pipelineStage.create({
    data: { businessId, pipelineId, name, position: (last?.position ?? -1) + 1 },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
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

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
}

export async function deletePipelineStage(businessId: string, pipelineId: string, stageId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId, businessId },
    orderBy: { position: "asc" },
  });

  if (stages.length <= 1) {
    throw new Error("Un embudo debe conservar al menos una etapa");
  }

  const toDelete = stages.find((s) => s.id === stageId);
  if (!toDelete) throw new Error("Invalid stage");

  // Conversations sitting in the deleted stage move to the first remaining
  // one in the same embudo instead of being blocked or silently orphaned.
  const fallback = stages.find((s) => s.id !== stageId)!;

  await prisma.$transaction([
    prisma.conversation.updateMany({
      where: { businessId, stageId },
      data: { stageId: fallback.id },
    }),
    prisma.pipelineStage.delete({ where: { id: stageId, businessId } }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
}

export async function movePipelineStage(
  businessId: string,
  pipelineId: string,
  stageId: string,
  direction: "left" | "right",
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId },
    orderBy: { position: "asc" },
  });

  const index = stages.findIndex((s) => s.id === stageId);
  const swapWith = direction === "left" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= stages.length) return;

  const a = stages[index];
  const b = stages[swapWith];

  await prisma.$transaction([
    // Bump `a` out of the way first so the (pipelineId, position) unique
    // constraint doesn't collide with `b` while swapping.
    prisma.pipelineStage.update({ where: { id: a.id }, data: { position: -1 } }),
    prisma.pipelineStage.update({ where: { id: b.id }, data: { position: a.position } }),
    prisma.pipelineStage.update({ where: { id: a.id }, data: { position: b.position } }),
  ]);

  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
}

export async function toggleAgentEnabled(businessId: string, enabled: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

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
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (!text && !file) throw new Error("text or file is required");

  const [business, conversation] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
    prisma.conversation.findFirstOrThrow({ where: { id: conversationId, businessId } }),
  ]);

  if (!business.wabaAccessToken || !business.wabaPhoneNumberId) {
    throw new Error("This business has no WhatsApp credentials configured");
  }

  const accessToken = decryptSecret(business.wabaAccessToken);
  const phoneNumberId = business.wabaPhoneNumberId;
  const to = conversation.customerPhone;

  if (file) {
    const mediaType = resolveMediaType(file.type);
    if (!mediaType) throw new Error("Tipo de archivo no soportado");
    if (file.size > MAX_ATTACHMENT_BYTES[mediaType]) {
      throw new Error(`El archivo supera el máximo permitido (${maxMbFor(mediaType)} MB)`);
    }

    let bytes: Buffer = Buffer.from(await file.arrayBuffer());
    let filename = file.name;
    let contentType = file.type;

    // WhatsApp only accepts/plays voice notes in Ogg/Opus — a browser
    // recording (see the mic button in ManualMessageForm) comes out as
    // WebM/Opus, which Meta silently rejects, so it's normalized here
    // before upload. Covers any other audio format someone attaches too.
    if (mediaType === "audio" && contentType !== "audio/ogg; codecs=opus") {
      bytes = await convertToOggOpus(bytes);
      filename = filename.replace(/\.[^.]+$/, "") + ".ogg";
      // Meta reads the Content-Type Meta's crawler fetches from our blob URL
      // to decide the media's format — plain "audio/ogg" (no codecs param)
      // is accepted at send time but then fails to play on the recipient's
      // phone ("this audio is no longer available"). The codecs parameter
      // is required, not optional, for WhatsApp to treat it as real Opus.
      contentType = "audio/ogg; codecs=opus";
    }

    const { url } = await uploadAttachment({ bytes, filename, contentType });

    // Meta doesn't support a caption on audio messages — if there's text
    // alongside a voice note, it goes out as its own follow-up message.
    const supportsCaption = mediaType !== "audio";
    const { messageId } = await sendWhatsAppMediaMessage({
      phoneNumberId,
      accessToken,
      to,
      type: mediaType,
      link: url,
      caption: supportsCaption && text ? text : undefined,
      filename: mediaType === "document" ? filename : undefined,
    });

    await prisma.message.create({
      data: {
        conversationId,
        role: "AGENT",
        content: supportsCaption ? text : "",
        whatsappMsgId: messageId,
        sentByHuman: true,
        mediaUrl: url,
        mediaType,
        mediaMimeType: contentType,
        mediaFilename: filename,
        mediaSizeBytes: bytes.byteLength,
      },
    });

    if (!supportsCaption && text) {
      const { messageId: textMessageId } = await sendWhatsAppTextMessage({ phoneNumberId, accessToken, to, text });
      await prisma.message.create({
        data: { conversationId, role: "AGENT", content: text, whatsappMsgId: textMessageId, sentByHuman: true },
      });
    }
  } else {
    const { messageId } = await sendWhatsAppTextMessage({ phoneNumberId, accessToken, to, text });
    await prisma.message.create({
      data: { conversationId, role: "AGENT", content: text, whatsappMsgId: messageId, sentByHuman: true },
    });
  }

  revalidatePath(`/dashboard/businesses/${businessId}/conversations/${conversationId}`);
  // This composer is also embedded in the CRM's WhatsApp-Web-style split
  // view (?tab=chat&conv=...), a different route — without revalidating it
  // too, a message sent from there goes out fine but never appears on
  // screen until a manual reload, looking exactly like a silent failure.
  revalidatePath(`/dashboard/businesses/${businessId}/crm`);
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

/**
 * The agency records the current paid-period window manually (no billing
 * integration) whenever they confirm a Hotmart payment — shown on
 * /dashboard/clients so they can see at a glance who's active, who's about
 * to renew, and who's overdue. Either date can be cleared by passing null.
 */
export async function updateBusinessSubscription(
  businessId: string,
  dates: { startedAt: string | null; endsAt: string | null },
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId: session.user.id, businessId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new Error("Only the agency can update a business's subscription dates");
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionStartedAt: dates.startedAt ? new Date(dates.startedAt) : null,
      subscriptionEndsAt: dates.endsAt ? new Date(dates.endsAt) : null,
    },
  });
  revalidatePath("/dashboard/clients");
}

export async function updateBusinessName(businessId: string, name: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  // The client (OWNER) or the agency (ADMIN) can rename their own business —
  // same floor as the other business-settings actions (see
  // requireBusinessOwnerOrAdmin). MEMBER (an invited salesperson) cannot.
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");

  await prisma.business.update({ where: { id: businessId }, data: { name: trimmed } });
  revalidatePath(`/dashboard/businesses/${businessId}`);
  revalidatePath("/dashboard");
}

/**
 * Permanently deletes a business — its agent, conversations, messages and
 * CRM stages cascade with it (see the onDelete: Cascade relations in
 * schema.prisma). Either the client (OWNER) or the agency (ADMIN) on this
 * specific business can do it: this is what lets a client free up a line
 * on their plan by dropping one agent before creating another (see
 * getAccountLineStatus in lib/lineLimits.ts).
 */
export async function deleteBusiness(businessId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  await prisma.business.delete({ where: { id: businessId } });
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
    const rateLimitKey = `reset:${email}`;
    // Same generic { submitted: true } either way — surfacing "too many
    // requests" here would itself leak whether the email exists faster than
    // just waiting the window out.
    if (await isRateLimited(rateLimitKey, RESET_REQUEST_MAX, RESET_REQUEST_WINDOW_MS)) {
      return { submitted: true };
    }
    await recordRateLimitEvent(rateLimitKey);

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

  const passwordHash = await bcrypt.hash(password, 12);
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
  const facebook = String(formData.get("facebook") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim();
  const tiktok = String(formData.get("tiktok") ?? "").trim();
  const linkedin = String(formData.get("linkedin") ?? "").trim();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone: phone || null,
      city: city || null,
      country: country || null,
      facebook: facebook || null,
      instagram: instagram || null,
      tiktok: tiktok || null,
      linkedin: linkedin || null,
    },
  });
  revalidatePath("/dashboard/account");
  revalidatePath("/dashboard");
  return { error: null, saved: true };
}

export type ChangePasswordState = { error: string | null; saved: boolean };

/**
 * Self-service password change from "Mi perfil" — the natural follow-up
 * once a client has logged in with a password the agency relayed manually
 * (see adminResetUserPassword below): they can pick their own from here
 * instead of staying on the one the agency generated for them. Requires
 * the current password, unlike the agency's reset, since this runs from an
 * already-authenticated session and should not let a hijacked session lock
 * the real owner out silently.
 */
export async function changeOwnPassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "La nueva contraseña debe tener al menos 8 caracteres", saved: false };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden", saved: false };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) {
    return { error: "La contraseña actual no es correcta", saved: false };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  });

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
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
  });

  return { password: newPassword };
}

function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Clean, human-readable, and unique — the business name alone for a first page, name+page-label for extra ones; a short numeric suffix only on an actual collision. */
async function generateUniqueWebsiteSlug(businessName: string, pageName: string, isFirstPage: boolean, excludeId?: string): Promise<string> {
  const base = slugifyText(isFirstPage ? businessName : `${businessName} ${pageName}`) || "sitio";

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.website.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// Creating a website page never depends on WhatsApp being connected — the
// two are independent features. When the real WABA number is available, use
// it; otherwise fall back to the owner's personal phone from "Mi perfil" so
// the site (and its WhatsApp CTA button) can still be created. Once
// WhatsApp connects, regenerating the page (see regenerateWebsitePage)
// naturally picks up the real API number instead.
async function resolveWhatsappNumberForBusiness(businessId: string): Promise<{ displayNumber: string }> {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });

  if (business.wabaAccessToken && business.wabaPhoneNumberId) {
    const accessToken = decryptSecret(business.wabaAccessToken);
    const displayNumber = await fetchWhatsAppDisplayNumber({ phoneNumberId: business.wabaPhoneNumberId, accessToken });
    if (displayNumber) return { displayNumber };
    // Meta lookup failed (expired token, etc.) — fall through to the
    // owner's phone below instead of blocking site creation over it.
  }

  const ownerMembership = await prisma.membership.findFirst({
    where: { businessId, role: "OWNER" },
    include: { user: { select: { phone: true } } },
  });
  const fallbackPhone = ownerMembership?.user.phone?.trim();
  if (fallbackPhone) return { displayNumber: fallbackPhone };

  throw new Error(
    "Agrega un número de WhatsApp en Mi perfil, o conecta las credenciales de WhatsApp de este negocio, para poder crear la página.",
  );
}

/**
 * Cheap, pre-summarized signal for the website generator's "objections"
 * block — reuses the sales diagnosis (see lib/diagnosis.ts) when one has
 * already been generated from this business's real conversations, since
 * that's already paid for and already a distilled summary (a few short
 * bullet points, not a transcript). Only falls back to reading raw
 * messages when no diagnosis exists yet, and even then keeps it small (a
 * handful of recent customer lines, trimmed) — this must stay cheap since
 * it runs on every "Generar sitio web" / "Regenerar" click.
 */
async function buildSalesContext(businessId: string, diagnosisReport: unknown): Promise<string | null> {
  if (diagnosisReport && typeof diagnosisReport === "object") {
    const report = diagnosisReport as Partial<SalesDiagnosis>;
    if (Array.isArray(report.debilidades) && report.debilidades.length > 0) {
      const recomendaciones = Array.isArray(report.recomendaciones) ? report.recomendaciones : [];
      return [
        "CONTEXTO DE VENTAS REAL (de un diagnóstico ya hecho sobre conversaciones reales de este negocio):",
        `- Lo que le está costando ventas hoy: ${report.debilidades.join("; ")}`,
        recomendaciones.length > 0 ? `- Recomendaciones ya identificadas: ${recomendaciones.join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const recentCustomerMessages = await prisma.message.findMany({
    where: { role: "CUSTOMER", conversation: { businessId } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { content: true },
  });
  if (recentCustomerMessages.length === 0) return null;

  const sample = recentCustomerMessages.map((m) => `- ${m.content.slice(0, 140)}`).join("\n");
  return `CONTEXTO DE VENTAS REAL (mensajes reales recientes de clientes de este negocio — úsalos para detectar dudas/objeciones típicas, no los cites literalmente):\n${sample}`;
}

/**
 * Creates a new page for this business — a business can have several (its
 * own mini funnel: a main site plus purpose-built pages like a demo-booking
 * page), each generated with structured, editable content (see
 * lib/websiteContent.ts) and served publicly at /sitio/[slug].
 */
export async function createWebsitePage(
  businessId: string,
  input: { name?: string; purpose?: string; ctaUrl?: string; designPrompt?: string },
): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  // Final safety net: whatever throws in here (a Prisma error, an
  // AnthropicError that slipped past generateWebsiteContent's own
  // handling, anything unexpected) gets logged with full detail and
  // re-thrown as a plain Error — plain strings always reach the client
  // intact; richer error objects don't reliably survive the Server Action
  // boundary and show up as an opaque "Minified React error #441" instead.
  await assertWebsiteGenerationAllowed(businessId);

  try {
    const [business, ownerMembership, existingCount] = await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: businessId }, include: { agent: true } }),
      prisma.membership.findFirst({
        where: { businessId, role: "OWNER" },
        include: { user: { select: { city: true, country: true, facebook: true, instagram: true, tiktok: true } } },
      }),
      prisma.website.count({ where: { businessId } }),
    ]);

    // No manual naming needed — the client never has to type anything that
    // looks like it's setting up a URL/domain (that confused people). The
    // public link's slug is derived from the business name automatically
    // (see generateUniqueWebsiteSlug below), completely separate from this
    // internal label.
    const name = input.name?.trim() || (existingCount === 0 ? "Sitio principal" : `Página ${existingCount + 1}`);

    const [{ displayNumber }, salesContext] = await Promise.all([
      resolveWhatsappNumberForBusiness(businessId),
      buildSalesContext(businessId, business.agent?.diagnosisReport),
    ]);

    const [content, aiImageUrl] = await Promise.all([
      generateWebsiteContent({
        businessName: business.name,
        industry: business.industry,
        description: business.agent?.systemPrompt ?? "",
        whatsappNumber: displayNumber,
        city: ownerMembership?.user.city,
        country: ownerMembership?.user.country,
        instagram: ownerMembership?.user.instagram,
        facebook: ownerMembership?.user.facebook,
        tiktok: ownerMembership?.user.tiktok,
        purpose: input.purpose,
        ctaUrl: input.ctaUrl,
        designPrompt: input.designPrompt,
        salesContext,
      }),
      generateHeroImage({
        businessName: business.name,
        industry: business.industry,
        description: business.agent?.systemPrompt ?? "",
      }),
    ]);
    await recordWebsiteGeneration(businessId);

    const slug = await generateUniqueWebsiteSlug(business.name, name, existingCount === 0);

    const website = await prisma.website.create({
      data: {
        businessId,
        name,
        purpose: input.purpose || null,
        designPrompt: input.designPrompt || null,
        slug,
        content,
        aiImageUrl,
        whatsappNumber: displayNumber,
        model: "claude-sonnet-5",
      },
    });

    revalidatePath(`/dashboard/businesses/${businessId}/website`);
    return { id: website.id };
  } catch (err) {
    console.error(`createWebsitePage failed for business ${businessId}:`, err);
    throw new Error(err instanceof Error ? err.message : "No se pudo generar el sitio web");
  }
}

/** Regenerates one page's content from scratch, reusing its stored name/purpose/design brief. */
export async function regenerateWebsitePage(businessId: string, websiteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);
  await assertWebsiteGenerationAllowed(businessId);

  // Same safety net as createWebsitePage above — see its comment.
  try {
    const [business, ownerMembership, website] = await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: businessId }, include: { agent: true } }),
      prisma.membership.findFirst({
        where: { businessId, role: "OWNER" },
        include: { user: { select: { city: true, country: true, facebook: true, instagram: true, tiktok: true } } },
      }),
      prisma.website.findFirstOrThrow({ where: { id: websiteId, businessId } }),
    ]);

    const [{ displayNumber }, salesContext] = await Promise.all([
      resolveWhatsappNumberForBusiness(businessId),
      buildSalesContext(businessId, business.agent?.diagnosisReport),
    ]);
    const existingContent = WebsiteContentSchema.safeParse(website.content);

    const [content, aiImageUrl] = await Promise.all([
      generateWebsiteContent({
        businessName: business.name,
        industry: business.industry,
        description: business.agent?.systemPrompt ?? "",
        whatsappNumber: displayNumber,
        city: ownerMembership?.user.city,
        country: ownerMembership?.user.country,
        instagram: ownerMembership?.user.instagram,
        facebook: ownerMembership?.user.facebook,
        tiktok: ownerMembership?.user.tiktok,
        purpose: website.purpose,
        ctaUrl: (existingContent.success ? existingContent.data.hero.ctaUrl : null) ?? undefined,
        designPrompt: website.designPrompt,
        salesContext,
      }),
      generateHeroImage({
        businessName: business.name,
        industry: business.industry,
        description: business.agent?.systemPrompt ?? "",
      }),
    ]);
    await recordWebsiteGeneration(businessId);

    await prisma.website.update({
      where: { id: websiteId },
      // Keep the previous image if this regeneration's image call failed
      // (API hiccup, content-policy refusal) — a transient failure
      // shouldn't cost the client an image that was already working.
      data: { content, aiImageUrl: aiImageUrl ?? website.aiImageUrl, whatsappNumber: displayNumber, model: "claude-sonnet-5" },
    });

    revalidatePath(`/dashboard/businesses/${businessId}/website`);
  } catch (err) {
    console.error(`regenerateWebsitePage failed for website ${websiteId}:`, err);
    throw new Error(err instanceof Error ? err.message : "No se pudo regenerar el sitio web");
  }
}

/** Saves edits made in the WebsiteEditor — text, colors, fonts, services/testimonials, video. Live immediately, no separate publish step. */
export async function updateWebsiteContent(businessId: string, websiteId: string, content: WebsiteContent): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const parsed = WebsiteContentSchema.parse(content);

  await prisma.website.update({
    where: { id: websiteId, businessId },
    data: { content: parsed },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/website`);
}

/**
 * The "pide cambios con IA" box in the editor — takes a free-text
 * instruction (e.g. "pon el botón en azul", "agrega una sección de
 * preguntas frecuentes"), applies it to the page's current content, and
 * saves the result immediately (same as editing a field by hand and
 * hitting Guardar). Returns the updated content so the editor can sync its
 * local state without a full reload.
 */
export async function applyWebsitePrompt(
  businessId: string,
  websiteId: string,
  instruction: string,
): Promise<WebsiteContent> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const trimmed = instruction.trim();
  if (!trimmed) throw new Error("Escribe qué cambio quieres");
  await assertWebsiteGenerationAllowed(businessId);

  // Same safety net as createWebsitePage — see its comment.
  try {
    const website = await prisma.website.findFirstOrThrow({ where: { id: websiteId, businessId } });
    const currentContent = WebsiteContentSchema.parse(website.content);

    const updated = await applyWebsiteEdit(currentContent, trimmed);
    await recordWebsiteGeneration(businessId);

    await prisma.website.update({
      where: { id: websiteId },
      data: { content: updated },
    });

    revalidatePath(`/dashboard/businesses/${businessId}/website`);
    return updated;
  } catch (err) {
    console.error(`applyWebsitePrompt failed for website ${websiteId}:`, err);
    throw new Error(err instanceof Error ? err.message : "No se pudo aplicar el cambio");
  }
}

export type UpdateCustomDomainResult = { ok: true } | { ok: false; error: string };

/**
 * Records the custom domain a client wants pointed at this specific page.
 * There's no automated Vercel-domain wiring here — the agency still has to
 * add the domain in the Vercel project dashboard once — but the DNS record
 * itself never depends on that step: it's shown to the client immediately
 * in DomainSection, computed straight from the hostname they typed, because
 * a subdomain's CNAME target (cname.vercel-dns.com) is the same for every
 * domain on this project.
 *
 * Only subdomains are accepted on purpose (agency policy: never point a
 * client's bare root domain here, so a mistake on our side can never take
 * down their main website) — enforced here, not just in the UI's copy, so
 * a request can't slip through. This is a simple label-count heuristic, not
 * a real public-suffix check, so it can't tell a true subdomain (x.example.com)
 * from a root domain under a two-part TLD (example.com.co) — good enough for
 * a soft guardrail, not a substitute for a human glancing at the request.
 */
export async function updateWebsiteCustomDomain(
  businessId: string,
  websiteId: string,
  formData: FormData,
): Promise<UpdateCustomDomainResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const customDomain = String(formData.get("customDomain") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  if (customDomain && customDomain.split(".").length < 3) {
    return {
      ok: false,
      error: "Pide un subdominio, no el dominio completo solo — ej: pagina.tunegocio.com, no tunegocio.com.",
    };
  }

  const before = await prisma.website.findUniqueOrThrow({
    where: { id: websiteId, businessId },
    select: { name: true, customDomain: true },
  });

  await prisma.website.update({
    where: { id: websiteId, businessId },
    data: { customDomain: customDomain || null },
  });

  // Notifies whoever has access to this business (the agency included, same
  // as any other notification here) that a manual step is waiting — the DNS
  // record itself doesn't need us (see DomainSection), but activating it
  // still means someone adds the domain in Vercel → Settings → Domains.
  // Only fires on a genuinely new request, not a re-save of the same value
  // or a clear, so it can't spam the bell every time the editor autosaves.
  if (customDomain && customDomain !== before.customDomain) {
    await prisma.notification.create({
      data: {
        businessId,
        type: "DOMAIN_REQUEST",
        message: `Piden conectar el dominio "${customDomain}" en "${before.name}" — agrégalo en Vercel → Settings → Domains.`,
      },
    });
  }

  revalidatePath(`/dashboard/businesses/${businessId}/website`);
  return { ok: true };
}

export async function deleteWebsitePage(businessId: string, websiteId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  await prisma.website.delete({ where: { id: websiteId, businessId } });

  revalidatePath(`/dashboard/businesses/${businessId}/website`);
}

/**
 * Just the internal label shown on the page's card in the list (e.g. "Paso
 * 2 — Agendar demo") — never the public URL/slug, which stays fixed once
 * generated so an existing link never breaks from a rename. Lets a client
 * with several pages tell them apart by which step of their funnel each one
 * is, instead of being stuck with the auto-numbered "Página 2".
 */
export async function renameWebsitePage(businessId: string, websiteId: string, name: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");

  await prisma.website.update({ where: { id: websiteId, businessId }, data: { name: trimmed } });

  revalidatePath(`/dashboard/businesses/${businessId}/website`);
}

/**
 * Creates a real booking-calendar page (Website.pageType = "agenda") — no
 * AI content generation at all (nothing here calls Anthropic, so it
 * doesn't touch the daily generation cap), just a page backed by
 * AgendaConfig and served by lib/agendaTemplate.ts. Lets a business chain
 * an offer page's button straight into a "página 2" that handles real
 * scheduling, entirely inside this app — no external tool required.
 * notificationEmail defaults to the owner's own login email so bookings
 * are never silently unreachable; editable afterward from the agenda's own
 * settings panel (see updateAgendaConfig below).
 */
export async function createAgendaPage(businessId: string, input: { name?: string }): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  try {
    const [business, existingCount] = await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: businessId } }),
      prisma.website.count({ where: { businessId } }),
    ]);
    const name = input.name?.trim() || `Agenda ${existingCount + 1}`;
    const [{ displayNumber }, slug] = await Promise.all([
      resolveWhatsappNumberForBusiness(businessId),
      generateUniqueWebsiteSlug(business.name, name, existingCount === 0),
    ]);

    const website = await prisma.website.create({
      data: {
        businessId,
        pageType: "agenda",
        name,
        slug,
        content: {},
        whatsappNumber: displayNumber,
        agendaConfig: {
          create: {
            notificationEmail: session.user.email ?? "",
            timezone: "America/Bogota",
            slotMinutes: 30,
            availability: DEFAULT_AVAILABILITY,
          },
        },
      },
    });

    revalidatePath(`/dashboard/businesses/${businessId}/website`);
    return { id: website.id };
  } catch (err) {
    console.error(`createAgendaPage failed for business ${businessId}:`, err);
    throw new Error(err instanceof Error ? err.message : "No se pudo crear la agenda");
  }
}

/** Saves an agenda page's settings (hours, slot length, notification email, timezone, accent color) — live immediately, same as updateWebsiteContent. */
export async function updateAgendaConfig(
  businessId: string,
  websiteId: string,
  input: { notificationEmail: string; timezone: string; slotMinutes: number; availability: Availability; primaryColor: string },
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const website = await prisma.website.findFirstOrThrow({ where: { id: websiteId, businessId } });
  if (website.pageType !== "agenda") throw new Error("Esta página no es una agenda");

  const notificationEmail = input.notificationEmail.trim();
  if (!notificationEmail) throw new Error("Falta el correo de notificaciones");
  const availability = AvailabilitySchema.parse(input.availability);
  const slotMinutes = Math.max(5, Math.min(240, Math.round(input.slotMinutes) || 30));
  const primaryColor = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}){0,2}$/.test(input.primaryColor) ? input.primaryColor : "#1f6feb";

  await prisma.agendaConfig.upsert({
    where: { websiteId },
    create: { websiteId, notificationEmail, timezone: input.timezone, slotMinutes, availability, primaryColor },
    update: { notificationEmail, timezone: input.timezone, slotMinutes, availability, primaryColor },
  });

  revalidatePath(`/dashboard/businesses/${businessId}/website/${websiteId}`);
}

// Photos/PDFs the AI agent can choose to send mid-conversation — see
// lib/ai.ts's "send_media" tool. Only image/document are offered here (no
// audio/video — an AI-initiated voice note or video doesn't make sense).
export async function addAgentMedia(businessId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  const label = String(formData.get("label") ?? "").trim();
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (!label) throw new Error("Escribe una descripción corta de qué es el archivo");
  if (!file) throw new Error("Selecciona una foto o un PDF");

  const existingCount = await prisma.agentMedia.count({ where: { businessId } });
  if (existingCount >= MAX_AGENT_MEDIA_PER_BUSINESS) {
    throw new Error(
      `Ya tienes el máximo de ${MAX_AGENT_MEDIA_PER_BUSINESS} archivos — borra uno para poder subir otro. Deja solo tus ${MAX_AGENT_MEDIA_PER_BUSINESS} productos más importantes.`,
    );
  }

  const mediaType = resolveMediaType(file.type);
  if (mediaType !== "image" && mediaType !== "document") {
    throw new Error("Solo se aceptan fotos o documentos (PDF) para esto");
  }
  if (file.size > MAX_ATTACHMENT_BYTES[mediaType]) {
    throw new Error(`El archivo supera el máximo permitido (${maxMbFor(mediaType)} MB)`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { url, size } = await uploadAttachment({ bytes, filename: file.name, contentType: file.type });

  await prisma.agentMedia.create({
    data: { businessId, url, mediaType, filename: file.name, label, sizeBytes: size },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export async function deleteAgentMedia(businessId: string, mediaId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  await prisma.agentMedia.delete({ where: { id: mediaId, businessId } });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}

export type InviteTeamMemberResult =
  | { status: "created"; email: string }
  | { status: "existing_user_added"; email: string };

/**
 * Lets the business owner (or the agency) add a teammate — e.g. a
 * salesperson — with their own login, so two people can be logged in at the
 * same time each working their own embudo (see the Pipeline model),
 * instead of everyone sharing one password. Deliberately role MEMBER, not
 * OWNER: see requireBusinessOwnerOrAdmin in lib/authz.ts for exactly what
 * that locks out (WhatsApp credentials, AI agent config, billing, deleting
 * the business, managing the team itself).
 *
 * The owner types the teammate's username and password themselves (instead
 * of the platform generating one) so the account is usable immediately —
 * no separate "reveal this once" step to relay.
 */
export async function inviteTeamMember(businessId: string, formData: FormData): Promise<InviteTeamMemberResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email) throw new Error("Nombre y correo son obligatorios");

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { planTier: true } });
  const teamLimit = TEAM_MEMBER_LIMITS[business.planTier];
  if (teamLimit !== null) {
    const teamCount = await prisma.membership.count({ where: { businessId, role: "MEMBER" } });
    if (teamCount >= teamLimit) {
      throw new Error(
        `Alcanzaste el límite de ${teamLimit} usuarios de equipo de tu plan ${PLAN_LABELS[business.planTier]}. Actualiza de plan o contáctanos para agregar más.`,
      );
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: { userId_businessId: { userId: existingUser.id, businessId } },
    });
    if (existingMembership) throw new Error("Esa persona ya es parte de este equipo");

    await prisma.membership.create({
      data: { userId: existingUser.id, businessId, role: "MEMBER" },
    });
    revalidatePath("/dashboard/account");
    // Already has an account (and its own password) from elsewhere — nothing
    // new to set, they just log in as usual and now see this business too.
    return { status: "existing_user_added", email };
  }

  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      memberships: { create: { businessId, role: "MEMBER" } },
    },
  });

  revalidatePath("/dashboard/account");
  return { status: "created", email };
}

export async function removeTeamMember(businessId: string, userId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessOwnerOrAdmin(session.user.id, businessId);

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });
  if (!membership) throw new Error("Esa persona no es parte de este equipo");
  if (membership.role !== "MEMBER") {
    throw new Error("No puedes quitar al dueño del negocio o a la agencia desde aquí");
  }

  await prisma.membership.delete({ where: { userId_businessId: { userId, businessId } } });
  revalidatePath("/dashboard/account");
}

/** Marks one notification read — e.g. when the user clicks it to open the conversation it's about. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { businessId: true },
  });
  if (!notification) return;
  await requireBusinessMembership(session.user.id, notification.businessId);

  await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
  revalidatePath("/dashboard");
}

/** "Marcar todas como leídas" in the notification bell — every unread notification across every business this user belongs to. */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const businessIds = (
    await prisma.membership.findMany({ where: { userId: session.user.id }, select: { businessId: true } })
  ).map((m) => m.businessId);

  await prisma.notification.updateMany({
    where: { businessId: { in: businessIds }, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard");
}

/**
 * A cheap "has anything changed" fingerprint for a business's conversations
 * — polled client-side (see CrmLivePoller) so the CRM's chat list and open
 * thread update live instead of needing a manual page reload. Just a count +
 * a max timestamp, not the actual data, so polling it every few seconds is
 * inexpensive; the client only re-fetches the real data (via router.refresh)
 * when this signature actually changes.
 */
export async function getConversationActivitySignature(businessId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireBusinessMembership(session.user.id, businessId);

  const result = await prisma.conversation.aggregate({
    where: { businessId },
    _max: { lastMessageAt: true },
    _count: { _all: true },
  });
  return `${result._count._all}:${result._max.lastMessageAt?.getTime() ?? 0}`;
}

/**
 * Cheap unread-notification count across every business this user belongs
 * to — polled client-side (see NotificationSoundPoller) so a sound alert can
 * fire the moment a new customer message/appointment notification lands,
 * without needing WebSockets. Just a count, not the notifications
 * themselves, so polling it every few seconds is inexpensive.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const businessIds = (
    await prisma.membership.findMany({ where: { userId: session.user.id }, select: { businessId: true } })
  ).map((m) => m.businessId);
  if (businessIds.length === 0) return 0;

  return prisma.notification.count({ where: { businessId: { in: businessIds }, readAt: null } });
}
