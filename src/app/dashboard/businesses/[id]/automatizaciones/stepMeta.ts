import type { StepType } from "@/lib/automations/flow";

// How each step is presented in the editor: its name, what it does in one
// line, and the colour family of its icon. The order is the order of the menu
// "Agrega el siguiente paso".

export type StepGroup = "mensajes" | "logica" | "datos" | "tiempo" | "control" | "integracion";

export const STEP_META: Record<StepType, { label: string; hint: string; group: StepGroup }> = {
  message: { label: "Mensaje", hint: "Envía un texto, con botones para que el cliente elija.", group: "mensajes" },
  reaction: { label: "Reacción", hint: "Pone un emoji al último mensaje del cliente.", group: "mensajes" },
  comment: { label: "Comentario", hint: "Deja una nota interna que solo ve tu equipo.", group: "datos" },
  internal: { label: "Enviar mensaje interno", hint: "Avisa a tu equipo con una notificación.", group: "datos" },
  list: { label: "Mensaje de lista (WhatsApp)", hint: "Un menú de opciones; cada una lleva a un camino.", group: "mensajes" },
  ai_condition: { label: "Condición de IA", hint: "La IA entiende lo que dijo el cliente y elige el camino.", group: "logica" },
  pause: { label: "Pausa", hint: "Espera un tiempo y continúa.", group: "tiempo" },
  actions: { label: "Acciones", hint: "Mueve de etapa, pone etiquetas, cambia datos del contacto.", group: "datos" },
  condition: { label: "Condición", hint: "Elige un camino según etiquetas, etapa, hora o datos.", group: "logica" },
  validation: { label: "Validación", hint: "Pide un dato (correo, teléfono, fecha) y revisa que esté bien.", group: "logica" },
  goto: { label: "Ir a otro paso", hint: "Salta a otro punto del flujo.", group: "control" },
  start_flow: { label: "Iniciar otro flujo", hint: "Pasa la conversación a otro flujo.", group: "control" },
  http: { label: "Enviar a una URL", hint: "Avisa a otro sistema con los datos del lead.", group: "integracion" },
  round_robin: { label: "Round Robin", hint: "Reparte los leads por turnos entre los embudos del equipo.", group: "datos" },
  stop: { label: "Parar flujo", hint: "Termina el flujo aquí.", group: "control" },
};

export const MENU_ORDER: StepType[] = ["message", "reaction", "comment", "internal", "list", "ai_condition", "pause", "actions", "condition", "validation", "goto", "start_flow", "http", "round_robin", "stop"];

export const GROUP_COLOR: Record<StepGroup, string> = {
  mensajes: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  logica: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  datos: "linear-gradient(135deg, #16a34a, #0f6e35)",
  tiempo: "linear-gradient(135deg, #f59e0b, #d9620b)",
  control: "linear-gradient(135deg, #6b7280, #374151)",
  integracion: "linear-gradient(135deg, #06b6d4, #0e7490)",
};

export const ACTION_LABELS = {
  move_stage: "Mover a la etapa",
  add_tag: "Poner la etiqueta",
  remove_tag: "Quitar la etiqueta",
  set_name: "Cambiar el nombre",
  set_email: "Guardar el correo",
  set_notes: "Agregar a las notas",
  pause_ai: "Pausar la IA en este chat",
  resume_ai: "Reactivar la IA en este chat",
} as const;

export const RULE_FIELDS = [
  { field: "tag", label: "Etiqueta" },
  { field: "stage", label: "Etapa" },
  { field: "message", label: "Lo que escribió el cliente" },
  { field: "hour", label: "Hora del día" },
  { field: "appointment", label: "Cita agendada" },
  { field: "email", label: "Correo" },
  { field: "name", label: "Nombre" },
] as const;

export const VALIDATION_LABELS = { email: "Un correo", phone: "Un teléfono", number: "Un número", date: "Una fecha (25/12/2026)", text: "Un texto" } as const;
