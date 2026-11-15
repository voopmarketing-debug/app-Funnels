// "Automático" model for an agent's WhatsApp replies: the economical model for
// the small stuff (greetings, thanks, quick questions) and the advanced one
// whenever the customer is showing buying intent or the message is not trivial.
// Decided per message, with no extra AI call: a model that costs more than the
// reply it is choosing for would defeat the point.

export const AUTO_AGENT_MODEL = "auto";
export const ADVANCED_AGENT_MODEL = "claude-sonnet-5";
export const ECONOMY_REPLY_MODEL = "claude-haiku-4-5";

/** Customer messages (in the last 20 of the chat) from which the chat counts as a conversation worth the advanced model. */
export const ENGAGED_AFTER_CUSTOMER_MESSAGES = 6;
const LONG_MESSAGE_CHARS = 240;
const TINY_MESSAGE_CHARS = 30;

export type TurnSignals = {
  /** What the customer just wrote (the transcript, for a voice note). */
  text: string;
  hasImages: boolean;
  /** How many of the recent messages in this chat came from the customer. */
  customerMessages: number;
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// Greetings and thanks: nothing to sell, nothing to decide.
const SMALL_TALK = /^(?:(?:hola|holi|ola|hey|buenas?|buenos|dias|tardes|noches|gracias|muchas|mil|ok|okay|okey|vale|listo|perfecto|dale|de|acuerdo|entendido|genial|excelente|super|chao|chau|adios|hasta|luego|bien|si|claro|saludos|igualmente|igual|tambien|amable|por|favor)\b[\s!.,¡¿?]*)+$/;

// Words that mean money, a date, a purchase or a complaint: these turns decide the sale.
const MONEY_OR_BOOKING =
  /\b(precio\w*|costo\w*|cuanto|cuesta\w*|tarifa\w*|cotiz\w*|presupuesto\w*|plan|planes|paquete\w*|promo\w*|descuento\w*|oferta\w*|agend\w*|cita|citas|reserv\w*|disponib\w*|horario\w*|cambi\w*|reprogram\w*|mover|compr\w*|pagar|pagos?|abono\w*|transfer\w*|link|enlace|quiero|necesito|interesa\w*|interesad\w*|contrat\w*|inscrib\w*|matricul\w*|factura\w*|garantia|devol\w*|reembols\w*|reclam\w*|queja\w*|problema\w*|cancel\w*|urgente|domicilio|envio\w*|stock)\b/;

// Amounts, dates, phone numbers, addresses: any run of 3+ digits, or $ followed by a number.
const NUMBERS = /\d{3,}|\$\s?\d/;

/** The model that answers this turn. A fixed model (anything but "auto") is returned as it is. */
export function resolveAgentModel(configured: string, turn: TurnSignals): string {
  if (configured !== AUTO_AGENT_MODEL) return configured;
  if (turn.hasImages) return ADVANCED_AGENT_MODEL; // a receipt, a photo of the problem…

  const text = normalize(turn.text);
  const noLetters = !/[a-z0-9]/.test(text); // only emojis or punctuation: 👍
  if (noLetters || (text.length <= TINY_MESSAGE_CHARS && SMALL_TALK.test(text))) return ECONOMY_REPLY_MODEL;

  if (text.length > LONG_MESSAGE_CHARS) return ADVANCED_AGENT_MODEL;
  if (MONEY_OR_BOOKING.test(text) || NUMBERS.test(text)) return ADVANCED_AGENT_MODEL;
  if (turn.customerMessages >= ENGAGED_AFTER_CUSTOMER_MESSAGES) return ADVANCED_AGENT_MODEL;
  return ECONOMY_REPLY_MODEL;
}
