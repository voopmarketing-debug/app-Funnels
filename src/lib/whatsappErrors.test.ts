import { describe, expect, it } from "vitest";
import { WhatsAppApiError, classifyWhatsAppError, isCriticalWhatsAppError, parseMetaErrorCodes, whatsAppErrorKind } from "./whatsappErrors";

describe("classifyWhatsAppError", () => {
  it.each([
    [190, "TOKEN_INVALID"],
    [131047, "OUT_OF_WINDOW"],
    [132001, "TEMPLATE_MISSING"],
    [132000, "TEMPLATE_PARAMS"],
    [132012, "TEMPLATE_PARAMS"],
    [132015, "TEMPLATE_UNAVAILABLE"],
    [130429, "RATE_LIMIT"],
    [131048, "RATE_LIMIT"],
    [131026, "RECIPIENT"],
    [10, "PERMISSION"],
    [200, "PERMISSION"],
    [299, "PERMISSION"],
    [999999, "OTHER"],
  ] as const)("code %i is %s", (code, kind) => {
    expect(classifyWhatsAppError(code)).toBe(kind);
  });

  it("falls back to the HTTP status when there is no code", () => {
    expect(classifyWhatsAppError(undefined, 401)).toBe("TOKEN_INVALID");
    expect(classifyWhatsAppError(undefined, 429)).toBe("RATE_LIMIT");
    expect(classifyWhatsAppError(undefined, 500)).toBe("OTHER");
  });
});

describe("isCriticalWhatsAppError", () => {
  it("is critical when the integration itself is broken", () => {
    for (const kind of ["TOKEN_INVALID", "PERMISSION", "TEMPLATE_MISSING", "TEMPLATE_UNAVAILABLE"] as const) expect(isCriticalWhatsAppError(kind)).toBe(true);
  });
  it("is not critical for a single message", () => {
    for (const kind of ["OUT_OF_WINDOW", "TEMPLATE_PARAMS", "RATE_LIMIT", "RECIPIENT", "OTHER"] as const) expect(isCriticalWhatsAppError(kind)).toBe(false);
  });
});

describe("parseMetaErrorCodes / WhatsAppApiError", () => {
  it("reads the code and subcode from Meta's body", () => {
    expect(parseMetaErrorCodes(JSON.stringify({ error: { code: 190, error_subcode: 463, message: "x" } }))).toEqual({ code: 190, subcode: 463 });
    expect(parseMetaErrorCodes("not json")).toEqual({});
  });

  it("keeps the kind, and the message carries no token", () => {
    const err = new WhatsAppApiError("Error validating access token", { httpStatus: 401, code: 190 });
    expect(err.kind).toBe("TOKEN_INVALID");
    expect(err).toBeInstanceOf(Error);
    expect(whatsAppErrorKind(err)).toBe("TOKEN_INVALID");
    expect(whatsAppErrorKind(new Error("boom"))).toBe("OTHER");
  });
});
