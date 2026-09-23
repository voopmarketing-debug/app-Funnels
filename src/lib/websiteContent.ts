import { z } from "zod";

// A curated, versatile set of Google Fonts — kept small and deliberate so
// every combination still looks intentional, and so the renderer only ever
// needs to load fonts from this fixed list (see lib/websiteTemplate.ts).
export const FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Playfair Display",
  "Merriweather",
  "Space Grotesk",
  "Nunito Sans",
  "Work Sans",
] as const;

// 6 content blocks (hero, offer, how it works, why us, objections, contact)
// — deliberately no "testimonios" block: the AI has no real reviews to draw
// on, and inventing fake customer quotes for a real business's public page
// is the kind of fabricated-social-proof pattern that damages trust the
// moment a visitor notices. "Objections" instead of a generic FAQ: it's
// where the page actually earns its keep, preempting the real doubts this
// business's customers raise in WhatsApp (see lib/websiteGenerator.ts's
// sales-context gathering).
// Hex-only (#rgb / #rrggbb / #rrggbbaa) — these three values get
// interpolated directly into a <style> block in lib/websiteTemplate.ts, so
// this format check is also what keeps that CSS context from being broken
// out of (a stored-XSS vector: the theme editor has a free-text color
// input, not just a color picker). `.catch(fallback)` means a single
// malformed value from the AI degrades to a safe default instead of
// failing the ENTIRE generation — before this, one bad field anywhere in
// the response threw a validation error that Next.js's Server Action
// boundary couldn't serialize cleanly, surfacing to the client as an
// opaque "Minified React error #441" instead of anything actionable.
function hexColorField(fallback: string) {
  return z
    .string()
    .regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3}){0,2}$/, "Debe ser un color hex válido, ej. #1f6feb")
    .catch(fallback);
}

export const WebsiteContentSchema = z.object({
  theme: z.object({
    primaryColor: hexColorField("#1f6feb").describe("Color principal en hex para botones y acentos, ej. #1f6feb — elegido a propósito para el rubro, no un genérico de IA."),
    backgroundColor: hexColorField("#ffffff").describe("Color de fondo del sitio en hex."),
    textColor: hexColorField("#0a0a0a").describe("Color del texto principal en hex, con buen contraste sobre backgroundColor."),
    headingFont: z.enum(FONT_OPTIONS).catch("Inter").describe("Fuente para títulos."),
    bodyFont: z.enum(FONT_OPTIONS).catch("Inter").describe("Fuente para texto de párrafo."),
  }),
  hero: z.object({
    heading: z.string().describe("Titular principal — la propuesta de valor del negocio, específica, no genérica."),
    subheading: z.string().describe("Una o dos frases que amplían el titular, con lo que realmente ofrece el negocio."),
    ctaLabel: z.string().describe('Texto del botón principal, ej. "Escríbenos por WhatsApp" o "Agenda tu demo".'),
    // Empty string is accepted alongside a real http(s) URL and null —
    // structured-output models often emit "" rather than null for "no
    // value here" despite the field being nullable, and every call site
    // that reads ctaUrl already treats "" the same as null via `||`
    // fallbacks (see proxy.ts, sitio/[slug]/ir/route.ts), so this doesn't
    // change behavior, it just stops that case from throwing at generation
    // time — this broke "Generar sitio web" for any business right after
    // this validation was added.
    ctaUrl: z
      .string()
      .regex(/^$|^https?:\/\/.+/, "Debe empezar con http:// o https://")
      .nullable()
      .catch(null)
      .describe(
        "URL externa a la que debe ir el botón principal (ej. un link de agenda/reservas), o null para usar el WhatsApp del negocio por defecto.",
      ),
  }),
  offer: z.object({
    heading: z.string(),
    items: z
      .array(z.object({ title: z.string(), description: z.string() }))
      .min(3)
      .max(4)
      .describe("3 a 4 servicios/productos concretos que ofrece el negocio, con datos reales, no relleno genérico."),
  }),
  howItWorks: z.object({
    heading: z.string().describe('Ej. "Cómo funciona" o "Así trabajamos contigo".'),
    items: z
      .array(z.object({ title: z.string(), description: z.string() }))
      .min(3)
      .max(4)
      .describe(
        "3 a 4 pasos concretos del proceso real para convertirse en cliente de este negocio (ej. 'Escríbenos' -> 'Agendamos una llamada' -> 'Empezamos'), en orden. Título corto tipo verbo + descripción de una frase.",
      ),
  }),
  whyUs: z.object({
    heading: z.string().describe('Ej. "Por qué elegirnos" — nunca un genérico "Sobre nosotros".'),
    items: z
      .array(z.object({ title: z.string(), description: z.string() }))
      .min(3)
      .max(4)
      .describe(
        "3 a 4 razones CONCRETAS y específicas de este negocio para elegirlo sobre la competencia — nunca genéricas tipo 'calidad y confianza' o 'años de experiencia' salvo que sea un dato real dado en la descripción del negocio.",
      ),
  }),
  objections: z.object({
    heading: z.string().describe('Ej. "Antes de escribirnos, resolvemos tus dudas" — no un genérico "Preguntas frecuentes".'),
    items: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .min(2)
      .max(4)
      .describe(
        "2 a 4 objeciones/dudas REALES de venta de este negocio y su respuesta — basadas en el contexto de conversaciones que se te da, no genéricas.",
      ),
  }),
  contact: z.object({
    heading: z.string(),
    body: z.string().describe("Frase corta invitando a escribir por WhatsApp."),
  }),
  // Always null when generated — never something the model spends tokens
  // deciding on. The client adds one later, if they want, from the editor.
  videoUrl: z.string().nullable().describe("Siempre null al generar — el cliente lo agrega después si quiere."),

  // Which of the optional sections actually render — set by the business
  // owner in the editor (see WebsiteEditor.tsx), never by the AI: this is
  // UI state, not content, so it's deliberately excluded from the schema
  // handed to zodOutputFormat in lib/websiteGenerator.ts (see
  // AiWebsiteContentSchema there) — asking the model to decide it would
  // just burn output tokens on something that should default to "show
  // everything". Each flag (and the object itself) falls back to `true`
  // via .catch() so older saved pages without this field, or a
  // partially-malformed one, still render every section instead of
  // silently going blank. hero and the lead-capture form are never
  // optional — always shown.
  visibleSections: z
    .object({
      offer: z.boolean().catch(true),
      howItWorks: z.boolean().catch(true),
      whyUs: z.boolean().catch(true),
      objections: z.boolean().catch(true),
      contact: z.boolean().catch(true),
    })
    .catch({ offer: true, howItWorks: true, whyUs: true, objections: true, contact: true }),
});

export type WebsiteContent = z.infer<typeof WebsiteContentSchema>;
export type VisibleSections = WebsiteContent["visibleSections"];
