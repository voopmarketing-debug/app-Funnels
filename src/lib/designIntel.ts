// Design intelligence for the website builder: a palette per kind of business.
//
// The palettes below are a curated subset (42 of 194 rows, the ones that fit local
// businesses) of the "product palettes" table of UI UX Pro Max
// (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, MIT License,
// Copyright (c) 2024 Next Level Builder; full notice in THIRD_PARTY_NOTICES.md),
// with Spanish keywords added so a business description can be matched to a row.
// It is only a starting point: the client's own brand colors always win.

export type DesignPalette = {
  type: string;
  kw: string[];
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  fg: string;
  notes: string;
};

export const DESIGN_PALETTES: DesignPalette[] = [
  { type: "E-commerce", kw: ["tienda", "ropa", "productos", "envíos", "compra", "ecommerce", "online"], primary: "#059669", secondary: "#10B981", accent: "#EA580C", bg: "#ECFDF5", fg: "#064E3B", notes: "Success green + urgency orange [Accent adjusted from #F97316]" },
  { type: "E-commerce Luxury", kw: ["lujo", "joyas", "joyería", "exclusivo", "premium"], primary: "#1C1917", secondary: "#44403C", accent: "#A16207", bg: "#FAFAF9", fg: "#0C0A09", notes: "Premium dark + gold accent [Accent adjusted from #CA8A04]" },
  { type: "B2B Service", kw: ["consultoría", "empresas", "b2b", "servicios profesionales", "contabilidad"], primary: "#0F172A", secondary: "#334155", accent: "#0369A1", bg: "#F8FAFC", fg: "#020617", notes: "Professional navy + blue CTA" },
  { type: "Creative Agency", kw: ["agencia creativa", "diseño", "branding"], primary: "#EC4899", secondary: "#F472B6", accent: "#0891B2", bg: "#FDF2F8", fg: "#831843", notes: "Bold pink + cyan accent [Accent adjusted from #06B6D4]" },
  { type: "Subscription Box Service", kw: ["suscripción", "caja", "box"], primary: "#D946EF", secondary: "#E879F9", accent: "#EA580C", bg: "#FDF4FF", fg: "#86198F", notes: "Excitement purple + urgency orange [Accent adjusted from #F97316]" },
  { type: "Hyperlocal Services", kw: ["servicios locales", "domicilio", "a domicilio"], primary: "#059669", secondary: "#10B981", accent: "#EA580C", bg: "#ECFDF5", fg: "#064E3B", notes: "Location green + action orange [Accent adjusted from #F97316]" },
  { type: "Beauty/Spa/Wellness Service", kw: ["estética", "spa", "belleza", "cosmética", "uñas", "peluquería", "barbería", "bienestar", "piel", "masajes", "depilación"], primary: "#EC4899", secondary: "#F9A8D4", accent: "#8B5CF6", bg: "#FDF2F8", fg: "#831843", notes: "Soft pink + lavender luxury" },
  { type: "Luxury/Premium Brand", kw: ["marca de lujo", "alta gama"], primary: "#1C1917", secondary: "#44403C", accent: "#A16207", bg: "#FAFAF9", fg: "#0C0A09", notes: "Premium black + gold accent [Accent adjusted from #CA8A04]" },
  { type: "Restaurant/Food Service", kw: ["restaurante", "comida", "gastronomía", "menú", "hamburguesas", "pizza", "sushi", "parrilla"], primary: "#DC2626", secondary: "#F87171", accent: "#A16207", bg: "#FEF2F2", fg: "#450A0A", notes: "Appetizing red + warm gold [Accent adjusted from #CA8A04]" },
  { type: "Fitness/Gym App", kw: ["gimnasio", "gym", "crossfit", "entrenamiento", "fitness", "pilates"], primary: "#F97316", secondary: "#FB923C", accent: "#22C55E", bg: "#1F2937", fg: "#F8FAFC", notes: "Energy orange + success green" },
  { type: "Real Estate/Property", kw: ["inmobiliaria", "apartamento", "casa", "lote", "arriendo", "propiedades", "inmueble"], primary: "#0F766E", secondary: "#14B8A6", accent: "#0369A1", bg: "#F0FDFA", fg: "#134E4A", notes: "Trust teal + professional blue" },
  { type: "Travel/Tourism Agency", kw: ["viajes", "turismo", "agencia de viajes", "tours", "paquetes"], primary: "#0EA5E9", secondary: "#38BDF8", accent: "#EA580C", bg: "#F0F9FF", fg: "#0C4A6E", notes: "Sky blue + adventure orange [Accent adjusted from #F97316]" },
  { type: "Hotel/Hospitality", kw: ["hotel", "hostal", "alojamiento", "hospedaje"], primary: "#1E3A8A", secondary: "#3B82F6", accent: "#A16207", bg: "#F8FAFC", fg: "#1E40AF", notes: "Luxury navy + gold service [Accent adjusted from #CA8A04]" },
  { type: "Wedding/Event Planning", kw: ["bodas", "matrimonio", "novias"], primary: "#DB2777", secondary: "#F472B6", accent: "#A16207", bg: "#FDF2F8", fg: "#831843", notes: "Romantic pink + elegant gold [Accent adjusted from #CA8A04]" },
  { type: "Legal Services", kw: ["abogado", "abogados", "jurídico", "legal", "notaría"], primary: "#1E3A8A", secondary: "#1E40AF", accent: "#B45309", bg: "#F8FAFC", fg: "#0F172A", notes: "Authority navy + trust gold" },
  { type: "Insurance Platform", kw: ["seguros", "póliza"], primary: "#0369A1", secondary: "#0EA5E9", accent: "#16A34A", bg: "#F0F9FF", fg: "#0C4A6E", notes: "Security blue + protected green [Accent adjusted from #22C55E]" },
  { type: "Online Course/E-learning", kw: ["curso", "cursos", "academia", "educación", "clases", "formación", "capacitación"], primary: "#0D9488", secondary: "#2DD4BF", accent: "#EA580C", bg: "#F0FDFA", fg: "#134E4A", notes: "Progress teal + achievement orange [Accent adjusted from #F97316]" },
  { type: "Non-profit/Charity", kw: ["fundación", "ong", "donaciones"], primary: "#0891B2", secondary: "#22D3EE", accent: "#EA580C", bg: "#ECFEFF", fg: "#164E63", notes: "Compassion blue + action orange [Accent adjusted from #F97316]" },
  { type: "Agriculture/Farm Tech", kw: ["agro", "finca", "agricultura", "campo"], primary: "#15803D", secondary: "#22C55E", accent: "#A16207", bg: "#F0FDF4", fg: "#14532D", notes: "Earth green + harvest gold [Accent adjusted from #CA8A04]" },
  { type: "Construction/Architecture", kw: ["construcción", "arquitectura", "obra", "remodelación", "ingeniería"], primary: "#64748B", secondary: "#94A3B8", accent: "#EA580C", bg: "#F8FAFC", fg: "#334155", notes: "Industrial grey + safety orange [Accent adjusted from #F97316]" },
  { type: "Automotive/Car Dealership", kw: ["carro", "carros", "concesionario", "vehículo", "vehículos", "moto", "motos", "autos", "automotriz", "usados", "0 km"], primary: "#1E293B", secondary: "#334155", accent: "#DC2626", bg: "#F8FAFC", fg: "#0F172A", notes: "Premium dark + action red" },
  { type: "Photography Studio", kw: ["fotografía", "fotógrafo", "estudio fotográfico"], primary: "#18181B", secondary: "#27272A", accent: "#F8FAFC", bg: "#000000", fg: "#FAFAFA", notes: "Pure black + white contrast" },
  { type: "Coworking Space", kw: ["coworking", "oficinas"], primary: "#F59E0B", secondary: "#FBBF24", accent: "#2563EB", bg: "#FFFBEB", fg: "#78350F", notes: "Energetic amber + booking blue" },
  { type: "Home Services (Plumber/Electrician)", kw: ["plomero", "electricista", "mantenimiento", "reparación", "aseo", "cerrajero", "fumigación"], primary: "#1E40AF", secondary: "#3B82F6", accent: "#EA580C", bg: "#EFF6FF", fg: "#1E3A8A", notes: "Professional blue + urgent orange [Accent adjusted from #F97316]" },
  { type: "Childcare/Daycare", kw: ["guardería", "jardín infantil", "niños"], primary: "#F472B6", secondary: "#FBCFE8", accent: "#16A34A", bg: "#FDF2F8", fg: "#9D174D", notes: "Soft pink + safe green [Accent adjusted from #22C55E]" },
  { type: "Senior Care/Elderly", kw: ["adulto mayor", "geriátrico", "cuidado de ancianos"], primary: "#0369A1", secondary: "#38BDF8", accent: "#16A34A", bg: "#F0F9FF", fg: "#0C4A6E", notes: "Calm blue + reassuring green [Accent adjusted from #22C55E]" },
  { type: "Medical Clinic", kw: ["clínica", "médico", "salud", "consultorio", "medicina"], primary: "#0891B2", secondary: "#22D3EE", accent: "#16A34A", bg: "#F0FDFA", fg: "#134E4A", notes: "Medical teal + health green [Accent adjusted from #22C55E]" },
  { type: "Pharmacy/Drug Store", kw: ["farmacia", "droguería"], primary: "#15803D", secondary: "#22C55E", accent: "#0369A1", bg: "#F0FDF4", fg: "#14532D", notes: "Pharmacy green + trust blue" },
  { type: "Dental Practice", kw: ["odontología", "dentista", "dental", "ortodoncia", "sonrisa"], primary: "#0EA5E9", secondary: "#38BDF8", accent: "#0EA5E9", bg: "#F0F9FF", fg: "#0C4A6E", notes: "Fresh blue + smile yellow [Accent adjusted from #FBBF24]" },
  { type: "Veterinary Clinic", kw: ["veterinaria", "mascotas", "perros", "gatos"], primary: "#0D9488", secondary: "#14B8A6", accent: "#EA580C", bg: "#F0FDFA", fg: "#134E4A", notes: "Caring teal + warm orange [Accent adjusted from #F97316]" },
  { type: "Florist/Plant Shop", kw: ["flores", "floristería", "plantas", "vivero"], primary: "#15803D", secondary: "#22C55E", accent: "#EC4899", bg: "#F0FDF4", fg: "#14532D", notes: "Natural green + floral pink" },
  { type: "Bakery/Cafe", kw: ["panadería", "café", "repostería", "pastelería", "postres"], primary: "#92400E", secondary: "#B45309", accent: "#92400E", bg: "#FEF3C7", fg: "#78350F", notes: "Warm brown + cream white [Accent adjusted from #F8FAFC]" },
  { type: "Brewery/Winery", kw: ["cerveza", "vino", "licores", "cervecería"], primary: "#7C2D12", secondary: "#B91C1C", accent: "#A16207", bg: "#FEF2F2", fg: "#450A0A", notes: "Deep burgundy + craft gold [Accent adjusted from #CA8A04]" },
  { type: "Marketing Agency", kw: ["marketing", "publicidad", "agencia de marketing", "redes sociales"], primary: "#EC4899", secondary: "#F472B6", accent: "#0891B2", bg: "#FDF2F8", fg: "#831843", notes: "Bold pink + creative cyan [Accent adjusted from #06B6D4]" },
  { type: "Event Management", kw: ["eventos", "producción de eventos"], primary: "#7C3AED", secondary: "#A78BFA", accent: "#EA580C", bg: "#FAF5FF", fg: "#4C1D95", notes: "Excitement purple + action orange [Accent adjusted from #F97316]" },
  { type: "Membership/Community", kw: ["membresía", "comunidad"], primary: "#7C3AED", secondary: "#A78BFA", accent: "#16A34A", bg: "#FAF5FF", fg: "#4C1D95", notes: "Community purple + join green [Accent adjusted from #22C55E]" },
  { type: "Digital Products/Downloads", kw: ["descargables", "plantillas", "ebook"], primary: "#6366F1", secondary: "#818CF8", accent: "#16A34A", bg: "#EEF2FF", fg: "#312E81", notes: "Digital indigo + buy green [Accent adjusted from #22C55E]" },
  { type: "Church/Religious Organization", kw: ["iglesia", "parroquia"], primary: "#7C3AED", secondary: "#A78BFA", accent: "#A16207", bg: "#FAF5FF", fg: "#4C1D95", notes: "Spiritual purple + warm gold [Accent adjusted from #CA8A04]" },
  { type: "Sports Team/Club", kw: ["club deportivo", "equipo", "deportes"], primary: "#DC2626", secondary: "#EF4444", accent: "#DC2626", bg: "#FEF2F2", fg: "#7F1D1D", notes: "Team red + championship gold [Accent adjusted from #FBBF24]" },
  { type: "Museum/Gallery", kw: ["museo", "galería", "arte"], primary: "#18181B", secondary: "#27272A", accent: "#18181B", bg: "#FAFAFA", fg: "#09090B", notes: "Gallery black + white space [Accent adjusted from #F8FAFC]" },
  { type: "Booking & Appointment App", kw: ["agendamiento", "citas", "reservas", "agenda"], primary: "#0284C7", secondary: "#0EA5E9", accent: "#059669", bg: "#F0F9FF", fg: "#0F172A", notes: "Calendar blue + available green" },
  { type: "Home Decoration & Interior Design", kw: ["decoración", "muebles", "interiores", "hogar"], primary: "#78716C", secondary: "#A8A29E", accent: "#D97706", bg: "#FAF5F2", fg: "#0F172A", notes: "Interior warm grey + gold accent" },
];

function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * The palette whose keywords appear most in the text (business description, brief, product
 * names); null when nothing matches, so the generator keeps its own industry direction.
 */
export function recommendPalette(text: string): DesignPalette | null {
  const haystack = ` ${norm(text)} `;
  let best: { row: DesignPalette; score: number } | null = null;
  for (const row of DESIGN_PALETTES) {
    let score = 0;
    for (const word of row.kw) {
      const w = norm(word);
      // Whole words only ("casa" must not match "casaca").
      if (new RegExp(`[^a-z0-9]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(haystack)) score += w.includes(" ") ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { row, score };
  }
  return best?.row ?? null;
}

/** One prompt line with the recommended palette, or "" when there is no match. */
export function paletteHint(text: string): string {
  const p = recommendPalette(text);
  if (!p) return "";
  return `- Paleta de referencia para este tipo de negocio (${p.type}: ${p.notes}): acento ${p.accent}, color principal ${p.primary}, secundario ${p.secondary}, fondo ${p.bg}, texto ${p.fg}. Es solo un punto de partida: si el cliente tiene colores de marca o pidió otros en su brief, usa los del cliente.`;
}
