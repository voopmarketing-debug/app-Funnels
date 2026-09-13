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
  // The prompt a client writes almost always includes "greet the customer" —
  // reasonable advice for the first message, but Claude has no memory across
  // calls and will follow it literally on every single reply otherwise. Tell
  // it explicitly whether this is a fresh conversation or an ongoing one.
  const continuityInstruction = isFirstMessage
    ? "Este es el primer mensaje de esta conversación — puedes saludar brevemente."
    : "Ya llevan una conversación en curso (mira el historial). NO vuelvas a saludar ni a presentarte — responde directo, como continuando un chat normal con alguien que ya conoces.";

  return `${basePrompt}\n\nContexto del negocio:\n- Rubro: ${industryLabel}. Adapta ejemplos, vocabulario y prioridades a este tipo de negocio.\n\nEstilo de respuesta:\n- ${toneInstruction}\n- ${lengthInstruction}\n- ${continuityInstruction}\n- Nunca uses formato markdown (sin **negritas** ni listas con guiones); escribe como en un chat normal.`;
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
