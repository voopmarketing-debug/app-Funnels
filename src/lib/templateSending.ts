import { prisma } from "@/lib/prisma";
import { variableCount } from "@/lib/templateVariables";
import { readStoredTags, resolveTags, type TagContext } from "@/lib/templateTags";

/**
 * The values for a template's {{N}} for one person: each tag filled with
 * their data. A template made without tags (in WhatsApp Manager, or before
 * tags existed) can only be filled if it has a single variable, the name;
 * anything else would be a guess, so it is reported instead of sent wrong.
 */
export function templateBodyParams(
  template: { bodyText: string; variableTags: unknown },
  ctx: TagContext,
): { ok: true; params: string[] | undefined; filledBody: string } | { ok: false; error: string } {
  const count = variableCount(template.bodyText);
  if (count === 0) return { ok: true, params: undefined, filledBody: template.bodyText };
  const tags = readStoredTags(template.variableTags) ?? (count === 1 ? (["nombre"] as const).slice() : null);
  if (!tags || tags.length !== count) {
    return { ok: false, error: "Esta plantilla tiene variables que la plataforma no sabe llenar. Créala de nuevo con etiquetas como [nombre del lead]." };
  }
  const resolved = resolveTags(tags, ctx);
  if (!resolved.ok) return { ok: false, error: resolved.reason };
  return { ok: true, params: resolved.values, filledBody: fillVariables(template.bodyText, resolved.values) };
}

/** {{1}}, {{2}}… replaced by the values, for the copy of the message kept in the chat. */
export function fillVariables(bodyText: string, values: string[]): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (whole, n: string) => values[Number(n) - 1] ?? whole);
}

/** The public link of the business's first agenda page, or null when it has none. */
export async function agendaUrlForBusiness(businessId: string): Promise<string | null> {
  const page = await prisma.website.findFirst({ where: { businessId, pageType: "agenda" }, orderBy: { id: "asc" }, select: { slug: true } });
  if (!page) return null;
  const host = process.env.APP_HOST ?? "agente.funnelslabs.app";
  return `https://${host}/sitio/${page.slug}`;
}
