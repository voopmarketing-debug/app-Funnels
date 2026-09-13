"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { requireBusinessMembership } from "@/lib/authz";

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

export async function createBusiness(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = String(formData.get("name") ?? "").trim();
  const wabaPhoneNumberId = sanitizeAsciiToken(String(formData.get("wabaPhoneNumberId") ?? ""));
  const wabaAccessToken = sanitizeAsciiToken(String(formData.get("wabaAccessToken") ?? ""));
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();

  if (!name || !wabaPhoneNumberId || !wabaAccessToken || !systemPrompt) {
    throw new Error("Missing required fields");
  }

  const business = await prisma.business.create({
    data: {
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      wabaPhoneNumberId,
      wabaAccessToken: encryptSecret(wabaAccessToken),
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

  if (!wabaPhoneNumberId || !wabaAccessToken) {
    throw new Error("Missing required fields");
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      wabaPhoneNumberId,
      wabaAccessToken: encryptSecret(wabaAccessToken),
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

  if (!systemPrompt) throw new Error("systemPrompt is required");

  await prisma.aIAgent.update({
    where: { businessId },
    data: { systemPrompt, temperature, enabled },
  });

  revalidatePath(`/dashboard/businesses/${businessId}`);
}
