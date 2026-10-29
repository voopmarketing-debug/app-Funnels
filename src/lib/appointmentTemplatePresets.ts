// The three appointment templates the platform sends by itself (see
// lib/appointmentMessaging.ts), ready to submit from "Plantillas" with one
// click. Plain data on purpose: the form (a client component) imports it.

export type TemplatePreset = {
  id: string;
  title: string;
  hint: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  body: string;
  /** One example per {{N}}, in order: what Meta's reviewers see. */
  examples: string[];
  buttons: { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url: string; phone: string }[];
};

export const APPOINTMENT_TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "confirmacion_cita",
    title: "Confirmación de cita",
    hint: "Se envía solo al agendar, si el cliente no te escribió en 24 h",
    name: "confirmacion_cita",
    language: "es",
    category: "UTILITY",
    body: "Hola {{1}}, tu cita quedó confirmada para el {{2}} a las {{3}}. Si necesitas cambiarla, respóndenos por aquí.",
    examples: ["Ana", "lunes 2 de noviembre", "3:30 pm"],
    buttons: [],
  },
  {
    id: "recordatorio_cita",
    title: "Recordatorio de cita",
    hint: "Se envía solo el día anterior a la cita",
    name: "recordatorio_cita",
    language: "es",
    category: "UTILITY",
    body: "Hola {{1}}, te recordamos tu cita de mañana, {{2}} a las {{3}}. ¿Nos confirmas que vas a asistir?",
    examples: ["Ana", "lunes 2 de noviembre", "3:30 pm"],
    buttons: [
      { type: "QUICK_REPLY", text: "Confirmo", url: "", phone: "" },
      { type: "QUICK_REPLY", text: "Necesito reagendar", url: "", phone: "" },
    ],
  },
  {
    id: "link_agendamiento",
    title: "Enlace para agendar",
    hint: "Se envía solo a quien dejó sus datos y no agendó (si lo activas)",
    name: "link_agendamiento",
    language: "es",
    category: "UTILITY",
    body: "Hola {{1}}, gracias por tu interés. Puedes agendar tu cita cuando quieras en este enlace: {{2}} Estamos para ayudarte.",
    examples: ["Ana", "https://agente.funnelslabs.app/sitio/mi-agenda"],
    buttons: [],
  },
];
