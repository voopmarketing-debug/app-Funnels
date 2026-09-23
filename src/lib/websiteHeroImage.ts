import { uploadAttachment } from "@/lib/attachments";
import { INDUSTRY_LABELS, INDUSTRY_DIRECTION } from "@/lib/websiteGenerator";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export type HeroImageContext = {
  businessName: string;
  industry: string;
  description: string;
};

/**
 * Generates one photorealistic hero photo for a business's website with
 * OpenAI's image model — the account already pays for OpenAI (see
 * lib/tts.ts's voice-note transcription/synthesis), so this reuses the same
 * API key instead of adding a new provider. "medium" quality is the
 * deliberate cost/quality balance: noticeably sharper than "low", a
 * fraction of "high"'s price, and this only runs once per business per
 * "Generar"/"Regenerar todo" click (never on a small AI text edit), riding
 * the same daily generation cap as the text content (see
 * assertWebsiteGenerationAllowed in actions.ts) — so cost stays bounded no
 * matter how often a client clicks.
 *
 * A failure here (content-policy refusal, API outage, no OPENAI_API_KEY
 * configured) never blocks page generation itself — it just falls back to
 * a text-only hero, same as a business that hasn't uploaded its own photo
 * (see getWebsiteHeroContext in lib/websiteHero.ts).
 */
export async function generateHeroImage(ctx: HeroImageContext): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const industryLabel = INDUSTRY_LABELS[ctx.industry] ?? INDUSTRY_LABELS.otro;
  const direction = INDUSTRY_DIRECTION[ctx.industry] ?? INDUSTRY_DIRECTION.otro;

  const prompt = `Fotografía profesional y editorial para el banner principal de la página web de un negocio real.
Negocio: "${ctx.businessName}" — rubro: ${industryLabel}.
${ctx.description ? `Qué hace: ${ctx.description}` : ""}
Dirección visual buscada: ${direction}

Debe ser una FOTOGRAFÍA realista de alta calidad — nunca una ilustración, render 3D, clip art ni ícono. Composición horizontal amplia, con espacio de aire para poner texto encima a un lado, buena luz natural, look editorial/premium. Sin texto, sin logos, sin marcas de agua, sin caras ni manos reconocibles de personas específicas.`;

  try {
    const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI image generation error (${response.status}):`, await response.text());
      return null;
    }

    const data = (await response.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    const { url } = await uploadAttachment({
      bytes: Buffer.from(b64, "base64"),
      filename: "hero.png",
      contentType: "image/png",
    });
    return url;
  } catch (err) {
    console.error("generateHeroImage failed:", err);
    return null;
  }
}
