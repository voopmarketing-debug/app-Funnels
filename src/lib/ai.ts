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
  const continuityInstruction = isFirstMessage
    ? "Este es el PRIMER mensaje de esta conversación (no hay historial previo) — puedes saludar y presentarte brevemente."
    : "Esta conversación YA ESTÁ EN CURSO — hay historial arriba. NO saludes de nuevo, NO te vuelvas a presentar, y NO le preguntes al cliente nada que ya te haya dicho en mensajes anteriores (su nombre, su negocio, qué necesita, etc.). Antes de preguntar algo, revisa el historial completo: si el dato ya está ahí, úsalo directamente y sigue avanzando la conversación en vez de repetir la pregunta.";

  // These platform rules go FIRST and are explicitly framed as
  // higher-priority than the business's own prompt below, because a
  // business's custom instructions ("saluda siempre", "pregunta su nombre")
  // are written assuming a single interaction, not a multi-turn chat, and
  // will otherwise fight with — and sometimes win over — the rules here.
  const platformRules = [
    "REGLAS DE LA PLATAFORMA (obligatorias, van antes que cualquier instrucción de abajo):",
    `- ${continuityInstruction}`,
    "- Esta es una conversación real y continua de WhatsApp, no interacciones aisladas. Compórtate como una persona que recuerda todo lo que se ha hablado en este chat.",
    "- Nunca repitas una pregunta, un saludo o una presentación que ya hiciste antes en este mismo historial.",
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
  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: MAX_TOKENS_BY_LENGTH[params.replyLength] ?? 300,
    system: buildSystemPrompt(
      params.systemPrompt,
      params.tone,
      params.replyLength,
      params.industry,
      params.history.length === 0,
    ),
    messages: [...params.history, { role: "user", content: params.userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }

  return textBlock.text;
}
