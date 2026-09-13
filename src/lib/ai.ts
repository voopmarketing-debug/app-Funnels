import Anthropic from "@anthropic-ai/sdk";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";

// API keys are always plain ASCII. Stripping anything else defends against
// a stray character sneaking in from a copy/paste of a masked/partial key
// view — e.g. a bullet character (•) — which otherwise sits silently in the
// Authorization header and surfaces as an opaque "ByteString" crash deep in
// the HTTP client on every single request, instead of a clear auth error.
function sanitizeAsciiToken(value: string): string {
  return value.replace(/[^\x21-\x7E]/g, "");
}

const anthropic = new Anthropic({
  apiKey: sanitizeAsciiToken(process.env.ANTHROPIC_API_KEY ?? ""),
});

export type AgentHistoryMessage = { role: "user" | "assistant"; content: string };

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
  breve: 300,
  media: 600,
  detallada: 1024,
};

const INDUSTRY_LABELS: Record<string, string> = Object.fromEntries(
  INDUSTRY_OPTIONS.map((option) => [option.value, option.label]),
);

// Belt-and-suspenders: the system prompt tells Claude not to open with a
// greeting past the first message, but prompt instructions are never a hard
// guarantee. Strip one leading greeting phrase in code so this can't slip
// through even if the model ignores the instruction.
const LEADING_GREETING_PATTERN =
  /^\s*(hola de nuevo|¡?hola|qu[ée] tal|buen[oa]s(?:\s+(?:d[ií]as|tardes|noches))?)\b[!,.\s]*[\p{Emoji_Presentation}\u{1F300}-\u{1FAFF}]*\s*/iu;

export function stripLeadingGreeting(text: string): string {
  const stripped = text.replace(LEADING_GREETING_PATTERN, "").trimStart();
  // Don't return an empty string if the whole reply was somehow just "Hola".
  if (stripped.length === 0) return text;
  // Re-capitalize in case stripping the greeting left a lowercase start,
  // e.g. "Hola, contame..." -> "contame..." -> "Contame...".
  return stripped[0].toUpperCase() + stripped.slice(1);
}

function buildSystemPrompt(
  basePrompt: string,
  tone: string,
  replyLength: string,
  industry: string,
  isFirstMessage: boolean,
): string {
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.cercano;
  const lengthInstruction = LENGTH_INSTRUCTIONS[replyLength] ?? LENGTH_INSTRUCTIONS.breve;
  const industryLabel = INDUSTRY_LABELS[industry] ?? INDUSTRY_LABELS.otro;
  // The prompt a client writes almost always includes "greet the customer"
  // and "ask their name/business" — reasonable advice for the first message,
  // but Claude has no memory across calls and will follow it literally on
  // every single reply otherwise, ignoring that the answer is sitting right
  // there in the message history it was given. Tell it explicitly.
  // "¡Hola!" in Spanish doubles as a warm interjection ("¡Hola, qué bueno!")
  // and not just a formal greeting, so telling the model to merely "not
  // greet again" wasn't enough — it kept opening every reply with "¡Hola!"
  // as an enthusiasm marker. Ban the literal word instead of the concept.
  const continuityInstruction = isFirstMessage
    ? "Este es el PRIMER mensaje de esta conversación (no hay historial previo) — puedes saludar y presentarte brevemente."
    : `Esta conversación YA ESTÁ EN CURSO — hay historial arriba, no es el primer contacto.
- PROHIBIDO empezar tu respuesta con "Hola", "¡Hola!", "Hola de nuevo", "Qué tal" o cualquier variante de saludo — ni siquiera como muletilla de entusiasmo. Empieza directo con el contenido de tu respuesta.
- NO te vuelvas a presentar como si fuera la primera vez que hablan.
- NO le preguntes al cliente nada que ya te haya dicho en mensajes anteriores de este historial (su nombre, su negocio, qué necesita, etc.) — revisa el historial completo antes de preguntar, y si el dato ya está ahí, úsalo directamente en vez de repetir la pregunta.
- Si te falta un solo dato (por ejemplo ya sabes el negocio pero no el nombre de la persona), pregunta SOLO por ese dato faltante. Nunca reformules una pregunta de varias partes ("¿cómo te llamas y cómo se llama tu negocio?") si una de esas partes ya fue respondida antes.`;

  // These platform rules go FIRST and are explicitly framed as
  // higher-priority than the business's own prompt below, because a
  // business's custom instructions ("saluda siempre", "pregunta su nombre")
  // are written assuming a single interaction, not a multi-turn chat, and
  // will otherwise fight with — and sometimes win over — the rules here.
  const platformRules = [
    "REGLAS DE LA PLATAFORMA (obligatorias, van antes que cualquier instrucción de abajo):",
    `- ${continuityInstruction}`,
    "- Esta es una conversación real y continua de WhatsApp, no interacciones aisladas. Compórtate como una persona que recuerda todo lo que se ha hablado en este chat.",
    `- ${toneInstruction}`,
    `- ${lengthInstruction}`,
    "- Nunca uses formato markdown (sin **negritas** ni listas con guiones); escribe como en un chat normal.",
  ].join("\n");

  return `${platformRules}\n\nContexto del negocio:\n- Rubro: ${industryLabel}. Adapta ejemplos, vocabulario y prioridades a este tipo de negocio.\n\nInstrucciones específicas de este negocio:\n${basePrompt}`;
}

export async function generateAgentReply(params: {
  systemPrompt: string;
  tone: string;
  replyLength: string;
  industry: string;
  model: string;
  history: AgentHistoryMessage[];
  userMessage: string;
}): Promise<string> {
  const isFirstMessage = params.history.length === 0;

  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: MAX_TOKENS_BY_LENGTH[params.replyLength] ?? 300,
    system: buildSystemPrompt(
      params.systemPrompt,
      params.tone,
      params.replyLength,
      params.industry,
      isFirstMessage,
    ),
    messages: [...params.history, { role: "user", content: params.userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }

  return isFirstMessage ? textBlock.text : stripLeadingGreeting(textBlock.text);
}
