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
    subheading: z.string().describe("Una o dos frases que amplían el titular."),
    ctaLabel: z.string().describe('Texto del botón principal, ej. "Escríbenos por WhatsApp" o "Agenda tu demo".'),
    ctaUrl: z
      .string()
      .nullable()
      .describe(
        "URL externa a la que debe ir el botón principal (ej. un link de agenda/reservas), o null para usar el WhatsApp del negocio por defecto.",
      ),
  }),
  about: z.object({
    heading: z.string(),
    body: z.string().describe("2-4 frases sobre el negocio, con datos reales dados, no relleno genérico."),
  }),
  services: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .min(3)
    .max(6)
    .describe("Servicios o productos concretos que ofrece el negocio."),
  testimonials: z
    .array(z.object({ quote: z.string(), author: z.string() }))
    .max(3)
    .describe("0 a 3 testimonios — si no hay reales, márcalos como ejemplo dentro del texto del autor, ej. '(ejemplo)'."),
  videoUrl: z.string().nullable().describe("URL de un video de YouTube o Vimeo para incrustar, o null si no aplica."),
  contact: z.object({
    heading: z.string(),
    body: z.string().describe("Frase corta invitando a escribir por WhatsApp."),
  }),
});

export type WebsiteContent = z.infer<typeof WebsiteContentSchema>;
