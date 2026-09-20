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

// Kept to exactly 4 content blocks (hero, offer, objections, contact) on
// purpose — fewer blocks means less to generate (cheaper) and less to edit
// (simpler). "Objections" replaces a generic about/services/testimonials
// split: it's where the page actually earns its keep, preempting the real
// doubts this business's customers raise in WhatsApp (see
// lib/websiteGenerator.ts's sales-context gathering).
export const WebsiteContentSchema = z.object({
  theme: z.object({
    primaryColor: z.string().describe("Color principal en hex para botones y acentos, ej. #1f6feb — elegido a propósito para el rubro, no un genérico de IA."),
    backgroundColor: z.string().describe("Color de fondo del sitio en hex."),
    textColor: z.string().describe("Color del texto principal en hex, con buen contraste sobre backgroundColor."),
    headingFont: z.enum(FONT_OPTIONS).describe("Fuente para títulos."),
    bodyFont: z.enum(FONT_OPTIONS).describe("Fuente para texto de párrafo."),
  }),
  hero: z.object({
    heading: z.string().describe("Titular principal — la propuesta de valor del negocio, específica, no genérica."),
    subheading: z.string().describe("Una o dos frases que amplían el titular, con lo que realmente ofrece el negocio."),
    ctaLabel: z.string().describe('Texto del botón principal, ej. "Escríbenos por WhatsApp" o "Agenda tu demo".'),
    ctaUrl: z
      .string()
      .nullable()
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
});

export type WebsiteContent = z.infer<typeof WebsiteContentSchema>;
