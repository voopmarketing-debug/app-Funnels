// What went wrong with a call to Meta's Graph API, in the terms this app acts
// on. Meta answers with a numeric `error.code`; the human message varies, so
// the code is what we classify by. The error keeps the code, the HTTP status
// and the kind, and never carries the access token (it only ever travels in
// the Authorization header).

export type WhatsAppErrorKind =
  | "TOKEN_INVALID" // the access token expired, was revoked or is malformed
  | "PERMISSION" // the token can't do this (missing permission, locked account, number not registered)
  | "OUT_OF_WINDOW" // free-form message outside the 24 h customer-care window
  | "TEMPLATE_MISSING" // the template name/language doesn't exist in this account
  | "TEMPLATE_PARAMS" // wrong number or format of {{variables}}
  | "TEMPLATE_UNAVAILABLE" // paused or disabled by Meta
  | "RATE_LIMIT" // throughput, spam or per-user limits reached
  | "RECIPIENT" // the recipient can't receive this (not on WhatsApp, same as sender, not allowed)
  | "OTHER";

const KIND_BY_CODE: Record<number, WhatsAppErrorKind> = {
  190: "TOKEN_INVALID",
  102: "TOKEN_INVALID",
  10: "PERMISSION",
  131031: "PERMISSION", // account locked
  133010: "PERMISSION", // phone number not registered
  131047: "OUT_OF_WINDOW",
  132001: "TEMPLATE_MISSING",
  132000: "TEMPLATE_PARAMS",
  132012: "TEMPLATE_PARAMS",
  132005: "TEMPLATE_PARAMS",
  132007: "TEMPLATE_PARAMS",
  132015: "TEMPLATE_UNAVAILABLE",
  132016: "TEMPLATE_UNAVAILABLE",
  130429: "RATE_LIMIT",
  131048: "RATE_LIMIT",
  131056: "RATE_LIMIT",
  80007: "RATE_LIMIT",
  4: "RATE_LIMIT",
  17: "RATE_LIMIT",
  32: "RATE_LIMIT",
  613: "RATE_LIMIT",
  131026: "RECIPIENT",
  131021: "RECIPIENT",
  131030: "RECIPIENT",
};

/** The permission-style codes Meta uses (200-299) all mean the token lacks access. */
export function classifyWhatsAppError(code: number | undefined, httpStatus?: number): WhatsAppErrorKind {
  if (code !== undefined) {
    const known = KIND_BY_CODE[code];
    if (known) return known;
    if (code >= 200 && code <= 299) return "PERMISSION";
  }
  if (httpStatus === 401) return "TOKEN_INVALID";
  if (httpStatus === 429) return "RATE_LIMIT";
  return "OTHER";
}

/** Errors that stop the integration (not just one message) and deserve an e-mail to the owner of the platform. */
export function isCriticalWhatsAppError(kind: WhatsAppErrorKind): boolean {
  return kind === "TOKEN_INVALID" || kind === "PERMISSION" || kind === "TEMPLATE_MISSING" || kind === "TEMPLATE_UNAVAILABLE";
}

const KIND_LABEL: Record<WhatsAppErrorKind, string> = {
  TOKEN_INVALID: "Token de WhatsApp inválido o vencido",
  PERMISSION: "El token no tiene permiso o la cuenta/número está bloqueado",
  OUT_OF_WINDOW: "Mensaje libre fuera de la ventana de 24 horas",
  TEMPLATE_MISSING: "La plantilla no existe o no está aprobada",
  TEMPLATE_PARAMS: "Las variables de la plantilla no coinciden",
  TEMPLATE_UNAVAILABLE: "La plantilla está pausada o deshabilitada por Meta",
  RATE_LIMIT: "Límite de envío alcanzado",
  RECIPIENT: "El destinatario no puede recibir el mensaje",
  OTHER: "Error de WhatsApp",
};

export function describeWhatsAppErrorKind(kind: WhatsAppErrorKind): string {
  return KIND_LABEL[kind];
}

export class WhatsAppApiError extends Error {
  readonly httpStatus: number | undefined;
  readonly code: number | undefined;
  readonly subcode: number | undefined;
  readonly kind: WhatsAppErrorKind;

  constructor(message: string, info: { httpStatus?: number; code?: number; subcode?: number } = {}) {
    super(message);
    this.name = "WhatsAppApiError";
    this.httpStatus = info.httpStatus;
    this.code = info.code;
    this.subcode = info.subcode;
    this.kind = classifyWhatsAppError(info.code, info.httpStatus);
  }
}

/** The numeric code and subcode out of a Graph API error body, if it has them. */
export function parseMetaErrorCodes(rawBody: string): { code?: number; subcode?: number } {
  try {
    const parsed = JSON.parse(rawBody) as { error?: { code?: unknown; error_subcode?: unknown } };
    const code = typeof parsed.error?.code === "number" ? parsed.error.code : undefined;
    const subcode = typeof parsed.error?.error_subcode === "number" ? parsed.error.error_subcode : undefined;
    return { code, subcode };
  } catch {
    return {};
  }
}

/** The kind of any thrown value: a WhatsAppApiError carries it, anything else is "OTHER". */
export function whatsAppErrorKind(err: unknown): WhatsAppErrorKind {
  return err instanceof WhatsAppApiError ? err.kind : "OTHER";
}
