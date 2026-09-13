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

  const lines = history.map((msg) => (msg.role === "user" ? `Cliente: ${msg.content}` : `Tú: ${msg.content}`));

  return [
    "ESTADO DE LA CONVERSACIÓN — LEE ESTO ANTES QUE CUALQUIER OTRA COSA:",
    "Ya llevan esta conversación (no es el primer contacto):",
    "---",
    lines.join("\n"),
    "---",
    "REGLA #1, LA MÁS IMPORTANTE DE TODAS: todo lo que el cliente ya escribió arriba (su nombre, su negocio, qué necesita, cualquier dato) YA LO SABES. Está prohibido volver a preguntarlo, sin importar cuántos mensajes hayan pasado o si el tema cambió. Si te falta un solo dato, pregunta SOLO por ese, una vez, y avanza — nunca repitas una pregunta de varias partes solo porque una parte sigue faltando.",
    "No saludes de nuevo ni te vuelvas a presentar (nada de \"Hola\", \"Buenas noches\", \"Qué tal\" al empezar ni a mitad de frase). No te disculpes por el tiempo de respuesta ni menciones demoras, ni siquiera si ves que tú mismo lo hiciste antes en esta transcripción — fue un error, no lo repitas.",
  ].join("\n");
}

const COMPREHENSION_RULES = [
  "La gente escribe rápido: con errores de tipeo, abreviado, en desorden, con jerga local o de forma indirecta. Interpreta la intención real detrás de sus palabras — no te quedes en la lectura literal si algo no tiene sentido así.",
  "Antes de responder, identifica exactamente qué te está diciendo o pidiendo el cliente EN ESE MENSAJE puntual, y en qué punto de la conversación están (mira el estado de arriba).",
  "Responde siempre con algo concreto y específico a lo que el cliente realmente dijo (un dato, un problema, una duda puntual) — nunca con una respuesta genérica que serviría para cualquier conversación con cualquier persona.",
]
  .map((rule) => `- ${rule}`)
  .join("\n");

function buildSystemPrompt(
  basePrompt: string,
  tone: string,
  replyLength: string,
  industry: string,
  history: AgentHistoryMessage[],
): string {
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.cercano;
  const lengthInstruction = LENGTH_INSTRUCTIONS[replyLength] ?? LENGTH_INSTRUCTIONS.breve;
  const industryLabel = INDUSTRY_LABELS[industry] ?? INDUSTRY_LABELS.otro;
  const isFirstMessage = history.length === 0;

  const styleRules = [
    "Eres un vendedor/asesor comercial profesional: seguro de sí mismo, directo, cordial, sin relleno.",
    toneInstruction,
    lengthInstruction,
    "Sin formato markdown (sin **negritas** ni listas con guiones) — escribe como en un chat normal.",
  ]
    .map((rule) => `- ${rule}`)
    .join("\n");

  const closingReminder = isFirstMessage
    ? ""
    : "\n\nRecordatorio final: no preguntes nada que el cliente ya te haya dicho en la transcripción de arriba, y no saludes ni te disculpes por demoras.";

  return `${buildConversationState(history)}\n\nCÓMO ENTENDER AL CLIENTE:\n${COMPREHENSION_RULES}\n\nESTILO DE RESPUESTA:\n${styleRules}\n\nCONTEXTO DEL NEGOCIO:\n- Rubro: ${industryLabel}. Adapta ejemplos, vocabulario y prioridades a este tipo de negocio.\n\nINSTRUCCIONES ESPECÍFICAS DE ESTE NEGOCIO:\n${basePrompt}${closingReminder}`;
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
      params.history,
    ),
    messages: [...params.history, { role: "user", content: params.userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }

  return stripGreetings(textBlock.text, isFirstMessage);
}
