// The three appointment templates the platform sends by itself (see
// lib/appointmentMessaging.ts), ready to submit from "Plantillas" with one
// click, written with tags (lib/templateTags.ts). Plain data on purpose: the
// form (a client component) imports it.

export type TemplatePreset = {
  id: string;
  title: string;
  hint: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  body: string;
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
    body: "Hola [nombre del lead], tu cita quedó confirmada para el [fecha de la cita] a las [hora de la cita]. Si necesitas cambiarla, respóndenos por aquí.",
    buttons: [],
  },
  {
    id: "recordatorio_cita",
    title: "Recordatorio de cita",
    hint: "Se envía solo el día anterior a la cita",
    name: "recordatorio_cita",
    language: "es",
    category: "UTILITY",
    body: "Hola [nombre del lead], te recordamos tu cita de mañana, [fecha de la cita] a las [hora de la cita]. ¿Nos confirmas que vas a asistir?",
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
    body: "Hola [nombre del lead], gracias por tu interés. Puedes agendar tu cita cuando quieras en este enlace: [enlace de agenda] Estamos para ayudarte.",
    buttons: [],
  },
];
