import type Anthropic from "@anthropic-ai/sdk";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { anthropic } from "@/lib/anthropicClient";

export type AgentHistoryMessage = { role: "user" | "assistant"; content: string };

// The image types Claude's vision input accepts — anything else a customer
// sends (e.g. HEIC) still reaches the AI, just as a text placeholder.
export const VISION_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type VisionImage = { mediaType: (typeof VISION_MEDIA_TYPES)[number]; data: string };

const TONE_INSTRUCTIONS: Record<string, string> = {
  cercano: "Tono cercano y cálido, como si le hablaras a un conocido — informal pero respetuoso.",
  formal: "Tono formal y profesional, cuidando la gramática y sin abreviaturas de chat.",
  directo: "Tono directo y al grano, sin rodeos ni frases de relleno.",
  divertido: "Tono desenfadado y con algo de humor liviano, sin perder profesionalismo.",
};

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  breve: "Responde en máximo 2-3 frases cortas, como en un chat de WhatsApp real.",
  media: "Responde en un párrafo corto (4-6 frases), claro y sin relleno.",
  detallada: "Puedes explayarte cuando el tema lo requiera, pero mantén párrafos cortos y fáciles de leer en el celular.",
};

const MAX_TOKENS_BY_LENGTH: Record<string, number> = {
  breve: 400,
  media: 700,
  detallada: 1024,
};

const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRY_OPTIONS.map((option) => [option.value, option.label]),
);

// Belt-and-suspenders: the system prompt tells Claude not to greet past the
// first message, but prompt instructions are never a hard guarantee — in
// testing it moved from opening with "Hola" to opening (and even
// mid-sentence inserting) "Buenas noches" instead, e.g. "¡Perfecto, buenas
// noches! Para armar...". So this strips the phrase wherever it appears in
// the reply, not just at the very start.
const LEADING_GREETING_PATTERN =
  /^\s*(¡?hola de nuevo|¡?hola|¡?qu[ée] tal|¡?buen[oa]s(?:\s+(?:d[ií]as|tardes|noches))?)\b[!,.\s]*[\p{Emoji_Presentation}\u{1F300}-\u{1FAFF}]*\s*/iu;

// Only the day-qualified "buenas noches/tardes/días" form is stripped when
// it's NOT at the very start — bare "buenas"/"buenos" is far too common as a
// normal adjective ("buenas noticias", "muy buenos resultados") to safely
// remove wherever it shows up in the sentence.
const EMBEDDED_GREETING_PATTERN =
  /(,\s*)?¡?\b(?:hola\s+de\s+nuevo|hola|qu[ée]\s+tal|buen[oa]s\s+(?:d[ií]as|tardes|noches))\b!?/giu;

// The transcript recap (see buildConversationState) includes the agent's own
// past replies, so once it apologizes for a delay once, it tends to treat
// that as its established voice and repeat it — a self-reinforcing loop the
// prompt instruction alone didn't reliably break. Strip it deterministically.
const DELAY_APOLOGY_PATTERN =
  /([,!]\s*)?¡?\b(?:perdona|disculpa|perdón)\s+(?:la\s+|por\s+la\s+|por\s+el\s+)?(?:demora|tardanza|espera)\b!?/giu;

function replacePrecededPunctuation(_match: string, punct: string | undefined): string {
  if (!punct) return "";
  return punct.trim() === "!" ? "!" : ".";
}

function cleanupPunctuation(text: string): string {
  return text
    .replace(/,\s*,/g, ",")
    .replace(/,\s*!/g, "!")
    .replace(/!\s*,/g, "!")
    .replace(/¡\s*!/g, "")
    .replace(/([!.,])\s*\.(?=\s|$)/g, "$1")
    .replace(/^[,!.\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    // A phrase removed from the middle of the sentence (e.g. ", buenas
    // noches!") becomes a period, which needs the next word capitalized to
    // read as a proper new sentence: "¡Perfecto. para armar" -> "... Para".
    .replace(/\.\s+([a-záéíóúñ])/g, (_m, ch: string) => `. ${ch.toUpperCase()}`);
}

export function stripGreetings(text: string, isFirstMessage: boolean): string {
  if (isFirstMessage) return text;

  let cleaned = text.replace(LEADING_GREETING_PATTERN, "");
  cleaned = cleaned.replace(EMBEDDED_GREETING_PATTERN, (_match, comma) => (comma ? "." : ""));
  cleaned = cleaned.replace(DELAY_APOLOGY_PATTERN, replacePrecededPunctuation);
  cleaned = cleanupPunctuation(cleaned);

  // Don't return an empty string if the whole reply was somehow just "Hola".
  if (cleaned.length === 0) return text;
  // Re-capitalize in case stripping left a lowercase start,
  // e.g. "Hola, contame..." -> "contame..." -> "Contame...".
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

// Models attend well to the very start and the very end of a long system
// prompt, and much less reliably to the middle — where a business's own
// (often long) custom prompt sits. Putting the transcript + the single most
// important rule (don't repeat what's already known) FIRST, ahead of
// everything else including the business prompt, showed clearly better
// compliance in testing than appending it at the end. This block is also
// short and repeats itself explicitly rather than being buried under a
// wall of other rules — LLMs follow a handful of sharp instructions more
// reliably than many overlapping ones.
function buildConversationState(history: AgentHistoryMessage[]): string {
  if (history.length === 0) {
    return "ESTADO DE LA CONVERSACIÓN: es el primer mensaje del cliente. No hay historial previo.";
  }

  // The transcript itself is the message history (sent once and cached),
  // not repeated here: a copy in the system prompt doubled the input billed
  // on every reply and, sitting before the history, kept it from caching.
  return [
    "ESTADO DE LA CONVERSACIÓN — LEE ESTO ANTES QUE CUALQUIER OTRA COSA:",
    "Ya llevan una conversación (no es el primer contacto): está completa en los mensajes anteriores. Léela entera antes de responder.",
    "REGLA #1, LA MÁS IMPORTANTE DE TODAS: todo lo que el cliente ya escribió arriba (su nombre, su negocio, qué necesita, cualquier dato) YA LO SABES. Está prohibido volver a preguntarlo, sin importar cuántos mensajes hayan pasado o si el tema cambió. Si te falta un solo dato, pregunta SOLO por ese, una vez, y avanza — nunca repitas una pregunta de varias partes solo porque una parte sigue faltando.",
    "Dentro de una charla activa no saludes de nuevo ni te vuelvas a presentar (nada de \"Hola\", \"Buenas noches\", \"Qué tal\" al empezar ni a mitad de frase). La única excepción: si el contexto del sistema del último mensaje dice que pasaron más de 24 horas desde el mensaje anterior, ahí sí saluda de nuevo con calidez, en una frase corta, y retoma donde quedaron. No te disculpes por el tiempo de respuesta ni menciones demoras, ni siquiera si ves que tú mismo lo hiciste antes en esta transcripción — fue un error, no lo repitas.",
    "Ojo: no saludar de nuevo NO significa sonar seco o robótico. Sigue siendo cálido y humano en cada respuesta: usa el nombre del cliente si lo sabes con certeza y muestra interés genuino en lo que dice.",
  ].join("\n");
}

const COMPREHENSION_RULES = [
  "La gente escribe rápido: con errores de tipeo, abreviado, en desorden, con jerga local o de forma indirecta. Interpreta la intención real detrás de sus palabras — no te quedes en la lectura literal si algo no tiene sentido así.",
  "Antes de responder, identifica exactamente qué te está diciendo o pidiendo el cliente EN ESE MENSAJE puntual, y en qué punto de la conversación están (mira el estado de arriba).",
  "Responde siempre con algo concreto y específico a lo que el cliente realmente dijo (un dato, un problema, una duda puntual) — nunca con una respuesta genérica que serviría para cualquier conversación con cualquier persona.",
]
  .map((rule) => `- ${rule}`)
  .join("\n");

export type AgentCatalogItem = {
  name: string;
  price: number | null;
  compareAtPrice: number | null;
  currency: string;
  category: string | null;
  description: string;
  soldOut: boolean;
  isService?: boolean;
};

function catalogPrice(value: number, currency: string): string {
  return currency === "USD" ? `US$${value.toLocaleString("en-US")}` : `$${value.toLocaleString("es-CO")}`;
}

// The business's product catalog (at most MAX_CATALOG_PRODUCTS, see
// lib/inventory.ts), part of the cached block: it only changes when the
// catalog is edited or a product sells out or comes back — never with each
// sale, since the exact units are deliberately left out.
function buildCatalogBlock(catalog?: AgentCatalogItem[]): string {
  if (!catalog || catalog.length === 0) return "";
  const lines = catalog.map((p) => {
    const price =
      p.price === null
        ? "precio a consultar"
        : `${catalogPrice(p.price, p.currency)}${p.compareAtPrice && p.compareAtPrice > p.price ? ` (antes ${catalogPrice(p.compareAtPrice, p.currency)})` : ""}`;
    const desc = p.description.replace(/\s+/g, " ").trim().slice(0, 140);
    return `- ${p.isService ? "[servicio] " : ""}${p.name} — ${price}${p.category ? ` · ${p.category}` : ""}${desc ? ` · ${desc}` : ""}${p.soldOut ? " · AGOTADO" : ""}`;
  });
  return `\n\nCATÁLOGO DE PRODUCTOS Y SERVICIOS (precios oficiales del negocio):\n${lines.join("\n")}\n\nReglas del catálogo: usa estos precios tal cual y no inventes productos ni precios que no estén aquí. Lo marcado [servicio] se agenda (cita, sesión, clase), no se envía: guía al cliente a elegir fecha y hora. Si algo está AGOTADO, dilo con amabilidad y ofrece una alternativa disponible parecida. Nunca menciones cuántas unidades hay en inventario.`;
}

export type OwnerContext = {
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
};

// Background facts the client set once in "Mi perfil" (never typed into
// their own editable prompt) — only the lines that are actually filled in
// are included, so an account with nothing set adds no noise here.
function buildOwnerContextBlock(owner?: OwnerContext): string {
  if (!owner) return "";

  const socials = [
    owner.instagram ? `Instagram ${owner.instagram}` : null,
    owner.facebook ? `Facebook ${owner.facebook}` : null,
    owner.tiktok ? `TikTok ${owner.tiktok}` : null,
    owner.linkedin ? `LinkedIn ${owner.linkedin}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join(", ");

  const lines = [
    owner.city && owner.country ? `- Ubicación: ${owner.city}, ${owner.country}` : owner.city ? `- Ciudad: ${owner.city}` : owner.country ? `- País: ${owner.country}` : null,
    owner.phone ? `- Teléfono/WhatsApp de contacto: ${owner.phone}` : null,
    socials ? `- Redes sociales: ${socials}` : null,
  ].filter((line): line is string => line !== null);

  if (lines.length === 0) return "";
  return `\n\nDATOS DE REFERENCIA DEL NEGOCIO (usa esto solo si el cliente pregunta algo relacionado, como ubicación o redes — no lo menciones por iniciativa propia):\n${lines.join("\n")}`;
}

// Split in two blocks instead of one string so the STABLE part (style +
// business context + the client's own prompt — identical for every message
// of every conversation this business gets, until they edit their agent
// settings) can carry a cache_control breakpoint, while the part that
// changes on every single message (the conversation-so-far recap) sits
// after it. Prompt caching only matches an exact byte-for-byte prefix, so
// anything volatile placed BEFORE a cached block silently breaks caching for
// everything that follows it — the recap can no longer come first like it
// used to. The 1h TTL keeps this business's cache warm across its other
// ongoing conversations too, not just consecutive replies in the same one.
function buildSystemPrompt(
  basePrompt: string,
  tone: string,
  replyLength: string,
  industry: string,
  history: AgentHistoryMessage[],
  owner?: OwnerContext,
  catalog?: AgentCatalogItem[],
): Anthropic.TextBlockParam[] {
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.cercano;
  const lengthInstruction = LENGTH_INSTRUCTIONS[replyLength] ?? LENGTH_INSTRUCTIONS.breve;
  const industryLabel = INDUSTRY_LABELS[industry] ?? INDUSTRY_LABELS.otro;
  const isFirstMessage = history.length === 0;

  const styleRules = [
    "Combinas tres perfiles en uno: piensas como un especialista en growth marketing (entiendes de embudos, conversión y cómo mover a alguien hacia la acción), tienes el instinto de un asesor comercial experimentado (calificas, generas interés real y guías hacia el cierre sin ser insistente) y la organización y calidez de una excelente secretaria o agente de servicio al cliente (atenta a los detalles, resolutiva, cortés, buena coordinando horarios y próximos pasos).",
    "Seguro de ti mismo, cordial y sin relleno, pero siempre cálido y humano, nunca seco ni telegráfico. Directo no es lo mismo que frío.",
    // The rules used to be written with voseo and it leaked into replies.
    "Escribe en español latinoamericano neutro y tutea al cliente (tú, tienes, puedes, cuéntame). Nunca uses voseo (vos, tenés, podés, contame, mirá, decime).",
    "Con los nombres, cero errores: usa solo el nombre que el cliente escribió en la conversación o el que aparece como NOMBRE DEL CLIENTE en el contexto. Si no estás seguro de cómo se llama, no uses ningún nombre; jamás lo adivines ni lo cambies.",
    toneInstruction,
    lengthInstruction,
    "Sin formato markdown (sin **negritas** ni listas con guiones) — escribe como en un chat normal.",
    // Each reply costs money and every extra back-and-forth is a chance to
    // lose the sale: resolve and advance in as few messages as possible.
    "Resuelve en la menor cantidad de mensajes posible: en cada respuesta contesta lo que el cliente preguntó Y avanza un paso hacia el cierre (agendar, comprar, dejar sus datos), en el mismo mensaje.",
    "Como mucho UNA pregunta por mensaje, y solo si de verdad la necesitas para avanzar. Si ya tienes lo necesario, propone directamente el siguiente paso.",
    "Nada de mensajes de relleno ni promesas de responder después (\"ya te cuento\", \"ahora te cuento\", \"dame un momento\", \"déjame revisar\"): responde de una vez con la información correcta para lo que preguntó.",
    "Cuando el cliente muestra interés concreto (pregunta precio, disponibilidad o cómo comprar), dale el dato y ofrécele el siguiente paso en ese mismo mensaje; no alargues la conversación con preguntas que no cambian la propuesta.",
  ]
    .map((rule) => `- ${rule}`)
    .join("\n");

  const closingReminder = isFirstMessage
    ? ""
    : "\n\nRecordatorio final: no preguntes nada que el cliente ya te haya dicho en los mensajes anteriores, y no saludes (salvo que hayan pasado más de 24 horas) ni te disculpes por demoras, pero mantén la calidez.";

  const cacheableBlock = `CÓMO ENTENDER AL CLIENTE:\n${COMPREHENSION_RULES}\n\nESTILO DE RESPUESTA:\n${styleRules}\n\nCONTEXTO DEL NEGOCIO:\n- Rubro: ${industryLabel}. Adapta ejemplos, vocabulario y prioridades a este tipo de negocio.${buildOwnerContextBlock(owner)}\n\nINSTRUCCIONES ESPECÍFICAS DE ESTE NEGOCIO:\n${basePrompt}${buildCatalogBlock(catalog)}`;
  const dynamicBlock = `${buildConversationState(history)}${closingReminder}`;

  return [
    { type: "text", text: cacheableBlock, cache_control: { type: "ephemeral", ttl: "1h" } },
    { type: "text", text: dynamicBlock },
  ];
}

export type AgentReplyUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export type AvailableMedia = { id: string; label: string; mediaType: string };

const SEND_MEDIA_TOOL_NAME = "send_media";

// Only built (and only added to the request) when the business actually has
// media uploaded — a business with none pays zero extra tokens/latency for
// this feature, and Claude never sees a tool it can't use.
function buildSendMediaTool(media: AvailableMedia[]): Anthropic.Tool {
  return {
    name: SEND_MEDIA_TOOL_NAME,
    description:
      "Envía una foto o un documento (PDF) real de este negocio al cliente por WhatsApp, junto con tu respuesta de texto. Úsala solo cuando el cliente pida ver algo (una foto, el catálogo, una ficha técnica) o cuando compartir uno de estos archivos claramente ayude a avanzar la venta — nunca por iniciativa sin que venga a cuento. Como mucho un archivo por turno.",
    input_schema: {
      type: "object",
      properties: {
        mediaId: {
          type: "string",
          description: "El id EXACTO del archivo a enviar, tomado de la lista de MATERIAL DISPONIBLE — nunca inventado.",
        },
      },
      required: ["mediaId"],
    },
  };
}

function buildAvailableMediaBlock(media: AvailableMedia[]): string {
  if (media.length === 0) return "";
  const lines = media
    .map((m) => `- id: ${m.id} | tipo: ${m.mediaType === "document" ? "documento (PDF)" : "foto"} | ${m.label}`)
    .join("\n");
  return `\n\nMATERIAL DISPONIBLE PARA ENVIAR (archivos reales de este negocio — usa la herramienta ${SEND_MEDIA_TOOL_NAME} solo si de verdad aplica, con uno de estos ids exactos):\n${lines}`;
}

const MARK_APPOINTMENT_TOOL_NAME = "mark_appointment";

// Always offered (unlike send_media, which only makes sense when a business
// has files uploaded) — any business's agent can end up confirming a
// meeting time in the chat itself, not just through an external booking
// link. Feeds Conversation.appointmentAt/appointmentNote (see
// updateConversationDetails in actions.ts) and a Notification row — see
// lib/agent.ts's handling of the tool_use block this produces.
function buildMarkAppointmentTool(): Anthropic.Tool {
  return {
    name: MARK_APPOINTMENT_TOOL_NAME,
    description:
      "Registra una cita SOLO cuando el cliente confirma una fecha y hora EXACTAS para una llamada, reunión, cita o demo (ej: 'sí, el jueves a las 3pm me sirve'). No la uses si solo se menciona la posibilidad de agendar, si falta la fecha o la hora, o si el cliente solo dice que va a agendar por un link sin confirmarte el horario que eligió.",
    input_schema: {
      type: "object",
      properties: {
        appointmentAt: {
          type: "string",
          description:
            "Fecha y hora exacta de la cita en formato ISO 8601 con offset de zona horaria, ej: '2026-09-25T15:00:00-05:00'. Usa la FECHA Y HORA ACTUAL de arriba para calcular fechas relativas ('mañana', 'el jueves'). Si el cliente no dio zona horaria, usa -05:00 (Colombia).",
        },
        note: {
          type: "string",
          description:
            "Breve descripción de la cita en pocas palabras, ej: 'Llamada de diagnóstico gratuito' o 'Demo del producto por Zoom'.",
        },
      },
      required: ["appointmentAt", "note"],
    },
  };
}

// Relative dates ("mañana", "el viernes") and a past appointment only make
// sense if the model knows what time it is: it has no clock of its own.
// Colombia time, this product's main market.
export type TurnContext = {
  // The contact's name as saved in the CRM (WhatsApp profile or typed by the team).
  contactName?: string | null;
  // When the conversation was last active before this message (see agent.ts).
  lastActivityAt?: Date | null;
  appointmentAt?: Date | null;
  appointmentNote?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function bogota(date: Date, withYear = false): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    ...(withYear && { year: "numeric" }),
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// A profile name worth calling someone by: letters, not an emoji or a phone.
function usableName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  return trimmed.length >= 2 && trimmed.length <= 40 && /\p{L}{2}/u.test(trimmed) && !/\d{4}/.test(trimmed) ? trimmed : null;
}

export function hadLongGap(turn: TurnContext | undefined, now = new Date()): boolean {
  return !!turn?.lastActivityAt && now.getTime() - turn.lastActivityAt.getTime() > DAY_MS;
}

/**
 * What changes from one message to the next (the clock, how long since the
 * last exchange, the appointment's status, the contact's name), sent at the
 * start of the customer's latest turn rather than in the system prompt:
 * anything that changes placed before the history would keep the history
 * from being read from the cache.
 */
export function buildTurnContext(turn: TurnContext | undefined, now = new Date()): string {
  const lines = [
    `FECHA Y HORA ACTUAL (Colombia, UTC-5): ${bogota(now, true)}. Úsala para calcular fechas relativas como "mañana" o "el viernes" al confirmar una cita con la herramienta ${MARK_APPOINTMENT_TOOL_NAME}.`,
  ];
  const name = usableName(turn?.contactName);
  if (name) lines.push(`NOMBRE DEL CLIENTE en el CRM: "${name}". Escríbelo exactamente así (o como el cliente diga que se llama en la conversación); nunca uses otro nombre.`);
  if (turn?.lastActivityAt && hadLongGap(turn, now)) {
    const days = Math.floor((now.getTime() - turn.lastActivityAt.getTime()) / DAY_MS);
    lines.push(`Pasaron ${days === 1 ? "más de 24 horas" : `${days} días`} desde el mensaje anterior: saluda de nuevo con calidez en una frase corta y retoma la conversación.`);
  }
  if (turn?.appointmentAt) {
    const what = turn.appointmentNote ? ` (${turn.appointmentNote})` : "";
    lines.push(
      turn.appointmentAt.getTime() > now.getTime()
        ? `Este cliente tiene una cita agendada para el ${bogota(turn.appointmentAt)}${what}.`
        : `Este cliente tenía una cita el ${bogota(turn.appointmentAt)}${what} y esa hora YA PASÓ: no hables de ella como algo pendiente ni digas "nos vemos" a esa hora. Pregúntale con amabilidad si alcanzó a asistir o si quiere reagendar.`,
    );
  }
  return `[Contexto del sistema, no lo menciones al cliente]\n${lines.join("\n")}`;
}

export type DetectedAppointment = { at: string; note: string };

const MOVE_STAGE_TOOL_NAME = "move_lead_stage";

// The lead's funnel stages, so the agent keeps the CRM up to date by itself
// as the chat advances. Stage names are the business's own (custom per
// funnel), so the description explains how to read them. The names only
// change when the business edits its funnel, so the tool stays inside the
// cached prefix; where the lead is right now goes in the dynamic block.
// What moves are allowed (forward only, never out of a won stage) is
// enforced in lib/autoStage.ts, not trusted to the model.
function buildMoveStageTool(stageNames: string[]): Anthropic.Tool {
  return {
    name: MOVE_STAGE_TOOL_NAME,
    description:
      "Mueve al cliente a otra etapa del embudo de ventas (CRM) cuando la conversación avanzó de verdad, para que el equipo sepa en qué va sin leer el chat. Úsala SIEMPRE además de tu respuesta de texto, nunca en lugar de ella, y solo cuando cambie la etapa (no la repitas si ya está ahí). Cómo leer las etapas: las de conversación o contacto inicial = ya está hablando contigo; las de interés o calificado = mostró interés concreto (preguntó precio, disponibilidad, formas de pago o cómo comprar); las de agendado, cita o reserva = confirmó fecha y hora; las de ganado, vendido o cerrado = confirmó la compra o dijo que ya pagó; las de perdido = dijo claramente que no le interesa o que compró en otro lado (no por un 'lo voy a pensar'). Si ninguna etapa encaja claramente, no la uses.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: stageNames, description: "Nombre EXACTO de la etapa a la que pasa el cliente." },
      },
      required: ["stage"],
    },
  };
}

export type LeadFunnel = { stages: string[]; current: string };

export async function generateAgentReply(params: {
  systemPrompt: string;
  tone: string;
  replyLength: string;
  industry: string;
  model: string;
  history: AgentHistoryMessage[];
  userMessage: string;
  // A photo the customer just sent, passed as real vision input so the
  // agent can actually respond to what's in it instead of guessing.
  userImages?: VisionImage[];
  owner?: OwnerContext;
  availableMedia?: AvailableMedia[];
  catalog?: AgentCatalogItem[];
  funnel?: LeadFunnel;
  turn?: TurnContext;
}): Promise<{ text: string; usage: AgentReplyUsage; sendMediaId?: string; appointment?: DetectedAppointment; stage?: string }> {
  // A first message, or one coming back after more than a day, may open with a greeting.
  const mayGreet = params.history.length === 0 || hadLongGap(params.turn);
  const availableMedia = params.availableMedia ?? [];

  const system = buildSystemPrompt(
    params.systemPrompt,
    params.tone,
    params.replyLength,
    params.industry,
    params.history,
    params.owner,
    params.catalog,
  );
  if (availableMedia.length > 0) {
    system[system.length - 1].text += buildAvailableMediaBlock(availableMedia);
  }
  const funnel = params.funnel && params.funnel.stages.length >= 2 ? params.funnel : undefined;
  if (funnel) {
    system[system.length - 1].text += `\n\nETAPA ACTUAL DEL CLIENTE EN EL EMBUDO: "${funnel.current}". Si con este mensaje avanzó (o se perdió), muévelo con la herramienta ${MOVE_STAGE_TOOL_NAME}.`;
  }

  const tools: Anthropic.Tool[] = [buildMarkAppointmentTool()];
  if (funnel) tools.push(buildMoveStageTool(funnel.stages));
  if (availableMedia.length > 0) tools.push(buildSendMediaTool(availableMedia));

  // The API rejects any turn with empty content ("user messages must have
  // non-empty content") — a caption-less photo, or a media-only reply in the
  // history, would otherwise fail the whole call and leave the customer
  // with no answer at all.
  const history: Anthropic.MessageParam[] = params.history.map((msg) => ({ ...msg, content: msg.content.trim() || "[Adjunto]" }));
  // Cache the conversation up to the previous message: the next reply in
  // this chat reads it at a tenth of the price instead of paying it again.
  const last = history.at(-1);
  if (last && typeof last.content === "string") {
    last.content = [{ type: "text", text: last.content, cache_control: { type: "ephemeral", ttl: "1h" } }];
  }
  const images = params.userImages ?? [];
  const userText = params.userMessage.trim() || (images.length > 0 ? "(El cliente envió esta imagen sin texto.)" : "[Adjunto]");
  const userContent: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }),
    ),
    { type: "text", text: buildTurnContext(params.turn) },
    { type: "text", text: userText },
  ];

  const request = {
    model: params.model,
    max_tokens: MAX_TOKENS_BY_LENGTH[params.replyLength] ?? 300,
    // Writing one short WhatsApp reply from an already-specified business
    // prompt doesn't need deep reasoning — Sonnet 5 runs adaptive thinking by
    // default even with no explicit `thinking` param, which silently bills
    // extra output tokens for a task that doesn't benefit from it (chat-
    // shaped workloads see ~30-50% lower cost at low effort with no
    // measurable accuracy loss, per Anthropic's published cost-optimization
    // benchmarks). Left untouched on the sales-diagnosis call in
    // diagnosis.ts, which genuinely reasons over several transcripts.
    // Haiku 4.5 (the economical option, see AGENT_MODELS) has no effort
    // control and doesn't think by default, so the param is only sent to
    // models that accept it.
    ...(params.model.startsWith("claude-haiku") ? {} : { output_config: { effort: "low" as const } }),
    system,
    tools,
  };
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userContent }];
  const response = await anthropic.messages.create({ ...request, messages });

  const toolUseBlocks = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  const mediaBlock = toolUseBlocks.find((block) => block.name === SEND_MEDIA_TOOL_NAME);
  const appointmentBlock = toolUseBlocks.find((block) => block.name === MARK_APPOINTMENT_TOOL_NAME);
  const stageBlock = toolUseBlocks.find((block) => block.name === MOVE_STAGE_TOOL_NAME);
  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
  };

  let rawText = textOf(response.content);
  // A turn that only marked an appointment or moved the stage still owes
  // the customer an answer: hand the tool results back and ask for the
  // text alone (tool_choice none), instead of sending a canned filler.
  // (A file sent with send_media can speak for itself.)
  if (!rawText && !mediaBlock && toolUseBlocks.length > 0) {
    const followUp = await anthropic.messages.create({
      ...request,
      tool_choice: { type: "none" },
      messages: [
        ...messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: toolUseBlocks.map((block) => ({ type: "tool_result" as const, tool_use_id: block.id, content: "Listo." })),
        },
      ],
    });
    rawText = textOf(followUp.content);
    usage.inputTokens += followUp.usage.input_tokens;
    usage.outputTokens += followUp.usage.output_tokens;
    usage.cacheCreationInputTokens += followUp.usage.cache_creation_input_tokens ?? 0;
    usage.cacheReadInputTokens += followUp.usage.cache_read_input_tokens ?? 0;
  }

  // Only a genuinely empty reply (no text AND no tool call) is an error.
  if (!rawText && !mediaBlock && !appointmentBlock && !stageBlock) {
    throw new Error("Claude did not return a text response");
  }

  const sendMediaId =
    mediaBlock && typeof mediaBlock.input === "object" && mediaBlock.input !== null
      ? (mediaBlock.input as { mediaId?: string }).mediaId
      : undefined;

  let appointment: DetectedAppointment | undefined;
  if (appointmentBlock && typeof appointmentBlock.input === "object" && appointmentBlock.input !== null) {
    const input = appointmentBlock.input as { appointmentAt?: string; note?: string };
    // A malformed date from the model shouldn't ever crash the whole reply —
    // just silently skip recording it, the human can still fill it in by hand.
    if (input.appointmentAt && input.note && !isNaN(new Date(input.appointmentAt).getTime())) {
      appointment = { at: input.appointmentAt, note: input.note };
    }
  }

  const stageInput = stageBlock?.input as { stage?: unknown } | undefined;
  const stage = typeof stageInput?.stage === "string" && funnel?.stages.includes(stageInput.stage) ? stageInput.stage : undefined;

  return {
    text: stripGreetings(rawText, mayGreet),
    sendMediaId: sendMediaId && availableMedia.some((m) => m.id === sendMediaId) ? sendMediaId : undefined,
    appointment,
    stage,
    usage,
  };
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
