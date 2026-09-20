import { prisma } from "@/lib/prisma";

// Shared by app/sitio/[slug]/registro/route.ts and proxy.ts's "/registro"
// branch (custom domains) — both just forward the submitted FormData here.
export async function captureWebsiteLead(websiteId: string, formData: FormData): Promise<boolean> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 120);
  const message = String(formData.get("message") ?? "").trim().slice(0, 500);
  if (!name || !contact) return false;

  await prisma.websiteLead.create({ data: { websiteId, name, contact, message: message || null } });
  return true;
}
