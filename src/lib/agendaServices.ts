import { z } from "zod";

// Pure (no server imports): used by the editor (client) and by the public page and the booking.

export const MAX_AGENDA_SERVICES = 20;

export const ServiceSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  // How long the appointment lasts; the calendar blocks that whole time.
  minutes: z.number().int().min(5).max(480),
  // Free text so it can read "$120.000", "Desde $80.000" or "Gratis".
  price: z.string().trim().max(40).optional().catch(undefined),
  description: z.string().trim().max(200).optional().catch(undefined),
});
export type AgendaService = z.infer<typeof ServiceSchema>;

/** What is stored in AgendaConfig.services, cleaned: invalid rows dropped, ids unique, at most MAX_AGENDA_SERVICES. */
export function parseServices(raw: unknown): AgendaService[] {
  if (!Array.isArray(raw)) return [];
  const out: AgendaService[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = ServiceSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    out.push({ ...parsed.data, price: parsed.data.price || undefined, description: parsed.data.description || undefined });
    if (out.length >= MAX_AGENDA_SERVICES) break;
  }
  return out;
}

/** "45 min", "1 h", "1 h 30 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
