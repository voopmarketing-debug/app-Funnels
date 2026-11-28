import { z } from "zod";
import { isAgendaStyle } from "@/lib/agendaStyles";
import { parseServices } from "@/lib/agendaServices";
import { parseFields, type AgendaField } from "@/lib/agendaFields";

// Pure (client + server). The editor shows its UNSAVED settings in the live preview by sending them as
// a "draft" query parameter; the public page applies it only in preview mode (never to real visitors).

const MAX_DRAFT_CHARS = 9000;

const DraftSchema = z.object({
  style: z.string().max(20).optional(),
  color: z.string().max(9).optional(),
  title: z.string().max(80).optional(),
  subtitle: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  mapUrl: z.string().max(500).optional(),
  logoUrl: z.string().max(500).optional(),
  askNote: z.boolean().optional(),
  services: z.unknown().optional(),
  fields: z.unknown().optional(),
});

export type AgendaDraft = {
  style?: string;
  color?: string;
  title?: string;
  subtitle?: string;
  address?: string;
  mapUrl?: string;
  logoUrl?: string;
  askNote?: boolean;
  services?: ReturnType<typeof parseServices>;
  fields?: AgendaField[];
};

/** The draft a visitor-facing preview should apply, or null when there is none or it is not valid. */
export function parseAgendaDraft(raw: string | null): AgendaDraft | null {
  if (!raw || raw.length > MAX_DRAFT_CHARS) return null;
  try {
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const d = parsed.data;
    return {
      style: isAgendaStyle(d.style) ? d.style : undefined,
      color: d.color && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(d.color) ? d.color : undefined,
      title: d.title,
      subtitle: d.subtitle,
      address: d.address,
      mapUrl: d.mapUrl,
      logoUrl: d.logoUrl,
      askNote: d.askNote,
      services: d.services === undefined ? undefined : parseServices(d.services),
      fields: d.fields === undefined ? undefined : parseFields(d.fields),
    };
  } catch {
    return null;
  }
}

/** What the editor appends to the preview URL (already stringified; the caller URL-encodes it). */
export function draftToParam(c: { style: string; primaryColor: string; title: string; subtitle: string; address: string; mapUrl: string; logoUrl: string; askNote: boolean; services: unknown; fields: unknown }): string {
  return JSON.stringify({ style: c.style, color: c.primaryColor, title: c.title, subtitle: c.subtitle, address: c.address, mapUrl: c.mapUrl, logoUrl: c.logoUrl, askNote: c.askNote, services: c.services, fields: c.fields });
}
