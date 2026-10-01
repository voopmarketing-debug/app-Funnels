"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin } from "@/lib/authz";
import { uploadAttachment } from "@/lib/attachments";
import { safeAnnouncementUrl } from "@/lib/announcements";

// Kept under the 4MB Server Action body limit (next.config.ts).
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function requireAgency(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  await requireAgencyAdmin(session.user.id);
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/novedades");
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type SaveAnnouncementState = { error: string | null; savedAt: number | null };

/** Create (no id) or update an announcement from the admin form. */
export async function saveAnnouncement(_prev: SaveAnnouncementState, formData: FormData): Promise<SaveAnnouncementState> {
  await requireAgency();

  const id = String(formData.get("id") ?? "").trim() || null;
  const kind = formData.get("kind") === "BANNER" ? "BANNER" : "NEWS";
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 600);
  if (!title || !body) return { error: "El título y el texto son obligatorios.", savedAt: null };

  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim().slice(0, 40) || null;
  const ctaUrlRaw = String(formData.get("ctaUrl") ?? "").trim();
  const ctaUrl = safeAnnouncementUrl(ctaUrlRaw);
  if (ctaUrlRaw && !ctaUrl) {
    return { error: "El enlace del botón debe empezar con https:// o ser una ruta de la plataforma (ej. /dashboard/agentes).", savedAt: null };
  }
  if (ctaUrl && !ctaLabel) return { error: "Escribe el texto del botón.", savedAt: null };

  let imageUrl = safeAnnouncementUrl(String(formData.get("imageUrl") ?? "")) ;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.has(file.type)) return { error: "La imagen debe ser JPG, PNG, WEBP o GIF.", savedAt: null };
    if (file.size > MAX_IMAGE_BYTES) return { error: "La imagen pesa más de 3,5 MB. Comprímela (por ejemplo en squoosh.app) y vuelve a subirla.", savedAt: null };
    try {
      const uploaded = await uploadAttachment({
        bytes: Buffer.from(await file.arrayBuffer()),
        filename: file.name || "novedad",
        contentType: file.type,
      });
      imageUrl = uploaded.url;
    } catch {
      return { error: "No se pudo subir la imagen. Intenta de nuevo.", savedAt: null };
    }
  }
  if (formData.get("removeImage") === "1") imageUrl = null;

  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));
  if (startsAt && endsAt && endsAt < startsAt) return { error: "La fecha de fin es anterior a la de inicio.", savedAt: null };

  const data = {
    kind,
    title,
    body,
    badge: String(formData.get("badge") ?? "").trim().slice(0, 20) || null,
    imageUrl,
    ctaLabel: ctaUrl ? ctaLabel : null,
    ctaUrl,
    published: formData.get("published") === "on",
    startsAt,
    endsAt,
  };

  if (id) {
    await prisma.announcement.update({ where: { id }, data });
  } else {
    const last = await prisma.announcement.aggregate({ _max: { position: true } });
    await prisma.announcement.create({ data: { ...data, position: (last._max.position ?? 0) + 1 } });
  }
  refresh();
  return { error: null, savedAt: Date.now() };
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await requireAgency();
  await prisma.announcement.delete({ where: { id } });
  refresh();
}

export async function toggleAnnouncementPublished(id: string): Promise<void> {
  await requireAgency();
  const current = await prisma.announcement.findUniqueOrThrow({ where: { id }, select: { published: true } });
  await prisma.announcement.update({ where: { id }, data: { published: !current.published } });
  refresh();
}

/** Swaps an announcement with its neighbour in display order. */
export async function moveAnnouncement(id: string, direction: "up" | "down"): Promise<void> {
  await requireAgency();
  const all = await prisma.announcement.findMany({ orderBy: [{ position: "asc" }, { createdAt: "desc" }], select: { id: true } });
  const index = all.findIndex((a) => a.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= all.length) return;
  [all[index], all[swapWith]] = [all[swapWith], all[index]];
  await prisma.$transaction(all.map((a, position) => prisma.announcement.update({ where: { id: a.id }, data: { position } })));
  refresh();
}
