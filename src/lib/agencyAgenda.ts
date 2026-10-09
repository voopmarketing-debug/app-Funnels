// Funnels Labs' own booking page (agenda.funnelslabs.app/agenda): three
// quick questions to qualify the visitor, then the calendar, then their
// details. The page itself is lib/agencyAgendaPage.ts; this file holds what
// both the page and the CRM endpoint (app/api/agenda-llamada) agree on.

export type AgendaQuestion = { id: "negocio" | "mensajes" | "inicio"; title: string; hint: string; options: { value: string; label: string; emoji: string }[] };

export const AGENDA_QUESTIONS: AgendaQuestion[] = [
  {
    id: "negocio",
    title: "¿Qué tipo de negocio tienes?",
    hint: "Así preparamos ejemplos de tu sector para la llamada.",
    options: [
      { value: "clinica", label: "Clínica o estética", emoji: "🩺" },
      { value: "tienda", label: "Tienda o e-commerce", emoji: "🛍️" },
      { value: "servicios", label: "Servicios profesionales", emoji: "💼" },
      { value: "educacion", label: "Educación o cursos", emoji: "🎓" },
      { value: "otro", label: "Otro", emoji: "✨" },
    ],
  },
  {
    id: "mensajes",
    title: "¿Cuántos mensajes de clientes recibes al mes por WhatsApp?",
    hint: "Un aproximado está bien.",
    options: [
      { value: "menos_50", label: "Menos de 50", emoji: "💬" },
      { value: "50_300", label: "50 a 300", emoji: "💬" },
      { value: "300_1000", label: "300 a 1.000", emoji: "🔥" },
      { value: "mas_1000", label: "Más de 1.000", emoji: "🚀" },
    ],
  },
  {
    id: "inicio",
    title: "¿Cuándo quieres empezar?",
    hint: "Para saber qué tan pronto te podemos ayudar.",
    options: [
      { value: "esta_semana", label: "Esta semana", emoji: "⚡" },
      { value: "este_mes", label: "Este mes", emoji: "📅" },
      { value: "averiguando", label: "Solo estoy averiguando", emoji: "👀" },
    ],
  },
];

export type AgendaAnswers = Partial<Record<AgendaQuestion["id"], string>>;

/**
 * Low volume AND just browsing: they get the info by WhatsApp instead of a
 * slot on the calendar. Anyone else books a call.
 */
export function isQualifiedLead(answers: AgendaAnswers): boolean {
  return !(answers.mensajes === "menos_50" && answers.inicio === "averiguando");
}

/** "clinica" → "Clínica o estética", for the CRM notes. */
export function answerLabel(questionId: AgendaQuestion["id"], value: string | undefined): string {
  const q = AGENDA_QUESTIONS.find((x) => x.id === questionId);
  return q?.options.find((o) => o.value === value)?.label ?? "—";
}

/** The booked slot ("2026-10-12" + "10:00") as an instant: the calendar is in Colombia time. */
export function colombiaSlot(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const date = new Date(`${fecha}T${hora}:00-05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
