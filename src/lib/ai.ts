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

// The transcript recap (see buildHistoryRecap) includes the agent's own past
// replies, so once it apologizes for a delay once, it tends to treat that as
// its established voice and repeat it — a self-reinforcing loop the prompt
// instruction alone didn't reliably break. Strip it deterministically too.
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

// Telling Claude "check the history before asking" relies on it noticing
// the fact buried in a growing list of separate message turns — and in
// testing with a long, dense business prompt, it kept losing track anyway
// (at one point flatly claiming "I don't have your name in this
// conversation" with the name sitting two turns up). Rendering the same
// history as an explicit plain-text transcript INSIDE the system prompt
// gives it a second, high-priority copy of the facts to check against,
// which is far more reliable than trusting turn-by-turn recall alone.
function buildHistoryRecap(history: AgentHistoryMessage[]): string {
  if (history.length === 0) return "";
  const lines = history.map((msg) => (msg.role === "user" ? `Cliente: ${msg.content}` : `Tú: ${msg.content}`));
  return `\n\nTRANSCRIPCIÓN EXACTA DE ESTA CONVERSACIÓN HASTA AHORA:\n${lines.join("\n")}\n\nCualquier dato que el cliente ya haya dado en esa transcripción (nombre, negocio, necesidad, lo que sea) cuenta como ya sabido — nunca lo pidas de nuevo.`;
}

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
    : `Esta conversación YA ESTÁ EN CURSO — más abajo tienes la transcripción exacta de todo lo hablado, no es el primer contacto.
- PROHIBIDO usar "Hola", "¡Hola!", "Hola de nuevo", "Qué tal", "Buenos días/tardes/noches" o cualquier variante de saludo — ni al empezar ni en medio de la respuesta, ni siquiera como muletilla de entusiasmo ("¡Perfecto, buenas noches!"). Empieza directo con el contenido de tu respuesta.
- NO te vuelvas a presentar como si fuera la primera vez que hablan.
- Antes de pedir cualquier dato (nombre, negocio, qué necesita, etc.), revisa la transcripción de abajo. Si ya aparece ahí, úsalo directamente — NUNCA lo vuelvas a preguntar, así hayan pasado varios mensajes o haya cambiado el tema.
- Si te falta un solo dato (por ejemplo ya sabes el negocio pero no el nombre de la persona), pregunta SOLO por ese dato faltante. Nunca reformules una pregunta de varias partes ("¿cómo te llamas y cómo se llama tu negocio?") si una de esas partes ya fue respondida antes.
- PROHIBIDO disculparte por el tiempo de respuesta o mencionar demoras: nunca digas "perdona la demora", "disculpa la tardanza", "ya estoy aquí", "perdón por no responder antes" ni nada similar — no sabes cuánto tiempo pasó ni al cliente le importa; comportarte así suena robótico. Aunque en la transcripción de abajo veas que TÚ mismo usaste antes una disculpa de este tipo, no la repitas ni la seas fiel — fue un error, corrígelo ahora.
- Actúa siempre como un vendedor/asesor comercial profesional: seguro de sí mismo, directo, cordial pero sin relleno ni disculpas innecesarias. Cada respuesta debe sonar a alguien que sabe lo que hace, no a un bot pidiendo perdón.`;

  // These platform rules go FIRST and are explicitly framed as
  // higher-priority than the business's own prompt below, because a
  // business's custom instructions ("saluda siempre", "pregunta su nombre")
  // are written assuming a single interaction, not a multi-turn chat, and
  // will otherwise fight with — and sometimes win over — the rules here.
  const platformRules = [
    "REGLAS DE LA PLATAFORMA (obligatorias, van antes que cualquier instrucción de abajo):",
    `- ${continuityInstruction}`,
    `- ${toneInstruction}`,
    `- ${lengthInstruction}`,
    "- Nunca uses formato markdown (sin **negritas** ni listas con guiones); escribe como en un chat normal.",
  ].join("\n");

  return `${platformRules}\n\nContexto del negocio:\n- Rubro: ${industryLabel}. Adapta ejemplos, vocabulario y prioridades a este tipo de negocio.\n\nInstrucciones específicas de este negocio:\n${basePrompt}${buildHistoryRecap(history)}`;
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
