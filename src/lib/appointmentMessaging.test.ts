import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { messageTemplate: { findFirst: (...a: unknown[]) => findFirst(...a) }, conversation: {}, message: {} } }));
vi.mock("@/lib/crypto", () => ({ decryptSecret: (v: string) => `dec(${v})` }));
const sendText = vi.fn();
const sendTemplate = vi.fn();
const templateStatus = vi.fn();
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppTextMessage: (...a: unknown[]) => sendText(...a),
  sendWhatsAppTemplateMessage: (...a: unknown[]) => sendTemplate(...a),
  fetchWhatsAppTemplateStatus: (...a: unknown[]) => templateStatus(...a),
}));
const reportFailure = vi.fn();
vi.mock("@/lib/whatsappAlerts", () => ({ reportWhatsAppSendFailure: (...a: unknown[]) => reportFailure(...a) }));

import { WhatsAppApiError } from "./whatsappErrors";
import {
  appointmentText,
  countTemplateVariables,
  formatAppointmentWhen,
  isInsideWhatsAppWindow,
  normalizeRecipientPhone,
  sendAppointmentMessage,
  templateParams,
} from "./appointmentMessaging";

const NOW = new Date("2026-10-28T20:00:00Z");
const business = { id: "b1", name: "Clínica Sol", wabaPhoneNumberId: "P1", wabaId: "W1", wabaAccessToken: "enc" };
const startsAt = new Date("2026-11-02T20:30:00Z"); // lunes 2 de noviembre, 3:30 p. m. in Bogotá
const base = { business, to: "3001234567", name: "Ana María Pérez", startsAt, timeZone: "America/Bogota", now: NOW };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the 24-hour window", () => {
  it("is open for a recent customer message and closed otherwise", () => {
    expect(isInsideWhatsAppWindow(new Date(NOW.getTime() - 60 * 60 * 1000), NOW)).toBe(true);
    expect(isInsideWhatsAppWindow(new Date(NOW.getTime() - 25 * 60 * 60 * 1000), NOW)).toBe(false);
    expect(isInsideWhatsAppWindow(null, NOW)).toBe(false);
  });
  it("counts a message sent 23h58m ago as already outside, to stay clear of Meta's cut", () => {
    expect(isInsideWhatsAppWindow(new Date(NOW.getTime() - (23 * 60 + 58) * 60 * 1000), NOW)).toBe(false);
  });
});

describe("message content", () => {
  it("writes the date and time in the business's time zone", () => {
    expect(formatAppointmentWhen(startsAt, "America/Bogota")).toEqual({ date: "lunes 2 de noviembre", time: "3:30 p. m." });
  });
  it("fills the template variables in the standard order and to the template's own count", () => {
    const v = { name: "Ana María Pérez", date: "lunes 2 de noviembre", time: "3:30 p. m.", url: "https://cal.example/x" };
    expect(templateParams("confirmation", v, 3)).toEqual(["Ana", "lunes 2 de noviembre", "3:30 p. m."]);
    expect(templateParams("reminder", v, 3)).toEqual(["Ana", "lunes 2 de noviembre", "3:30 p. m."]);
    expect(templateParams("link", v, 2)).toEqual(["Ana", "https://cal.example/x"]);
    expect(templateParams("reminder", v, 1)).toEqual(["Ana"]);
    expect(templateParams("link", { ...v, name: null }, 2)[0]).toBe("cliente");
  });
  it("counts a template's variables", () => {
    expect(countTemplateVariables("Hola {{1}}, tu cita es el {{2}} a las {{3}}")).toBe(3);
    expect(countTemplateVariables("Sin variables")).toBe(0);
  });
  it("has a free-text version of each message", () => {
    const v = { name: "Ana", date: "lunes 2 de noviembre", time: "3:30 p. m.", url: "https://cal.example/x", businessName: "Clínica Sol" };
    expect(appointmentText("confirmation", v)).toContain("confirmada");
    expect(appointmentText("reminder", v)).toContain("Te recordamos");
    expect(appointmentText("link", v)).toContain("https://cal.example/x");
  });
  it("gives a bare Colombian mobile its country code", () => {
    expect(normalizeRecipientPhone("300 123 4567")).toBe("573001234567");
    expect(normalizeRecipientPhone("+57 300 123 4567")).toBe("573001234567");
    expect(normalizeRecipientPhone("+1 202 555 0100")).toBe("12025550100");
  });
});

describe("sendAppointmentMessage", () => {
  it("writes freely inside the window", async () => {
    sendText.mockResolvedValue({ messageId: "wamid.1" });
    const res = await sendAppointmentMessage({ ...base, kind: "confirmation", lastCustomerMessageAt: new Date(NOW.getTime() - 3600_000) });
    expect(res).toMatchObject({ ok: true, via: "text", messageId: "wamid.1" });
    expect(sendText).toHaveBeenCalledWith(expect.objectContaining({ to: "573001234567", accessToken: "dec(enc)" }));
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("uses the approved template, with its variables, outside the window", async () => {
    findFirst.mockResolvedValue({ name: "confirmacion_cita", language: "es", bodyText: "Hola {{1}}, cita {{2}} {{3}}" });
    sendTemplate.mockResolvedValue({ messageId: "wamid.2" });
    const res = await sendAppointmentMessage({ ...base, kind: "confirmation", lastCustomerMessageAt: null });
    expect(res).toMatchObject({ ok: true, via: "template" });
    expect(sendText).not.toHaveBeenCalled();
    expect(sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ templateName: "confirmacion_cita", language: "es", bodyParams: ["Ana", expect.stringContaining("2 de noviembre"), expect.stringMatching(/3:30/)] }));
  });

  it("finds a template created straight in WhatsApp Manager through Meta", async () => {
    findFirst.mockResolvedValue(null);
    templateStatus.mockResolvedValue({ status: "APPROVED", rejectionReason: null });
    sendTemplate.mockResolvedValue({ messageId: "wamid.3" });
    const res = await sendAppointmentMessage({ ...base, kind: "reminder", lastCustomerMessageAt: null });
    expect(res).toMatchObject({ ok: true, via: "template" });
    expect(templateStatus).toHaveBeenCalledWith(expect.objectContaining({ wabaId: "W1", name: "recordatorio_cita" }));
    expect(sendTemplate).toHaveBeenCalledWith(expect.objectContaining({ templateName: "recordatorio_cita", bodyParams: expect.any(Array) }));
  });

  it("reports that a template is needed when there is none approved", async () => {
    findFirst.mockResolvedValue(null);
    templateStatus.mockResolvedValue({ status: "PENDING", rejectionReason: null });
    const res = await sendAppointmentMessage({ ...base, kind: "link", url: "https://cal.example/x", lastCustomerMessageAt: null });
    expect(res).toEqual({ ok: false, reason: "NEEDS_TEMPLATE" });
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("falls back to the template when Meta says the window is closed", async () => {
    sendText.mockRejectedValue(new WhatsAppApiError("Re-engagement message", { code: 131047, httpStatus: 400 }));
    findFirst.mockResolvedValue({ name: "recordatorio_cita", language: "es", bodyText: "{{1}} {{2}} {{3}}" });
    sendTemplate.mockResolvedValue({ messageId: "wamid.4" });
    const res = await sendAppointmentMessage({ ...base, kind: "reminder", lastCustomerMessageAt: new Date(NOW.getTime() - 3600_000) });
    expect(res).toMatchObject({ ok: true, via: "template" });
  });

  it("returns the failure, and reports it, instead of throwing", async () => {
    sendText.mockRejectedValue(new WhatsAppApiError("Error validating access token", { code: 190, httpStatus: 401 }));
    const res = await sendAppointmentMessage({ ...base, kind: "confirmation", lastCustomerMessageAt: new Date(NOW.getTime() - 3600_000) });
    expect(res).toMatchObject({ ok: false, reason: "SEND_FAILED", kind: "TOKEN_INVALID" });
    expect(reportFailure).toHaveBeenCalledWith(expect.any(WhatsAppApiError), { businessId: "b1", context: "confirmación de cita" });
  });

  it("does nothing for a business without WhatsApp", async () => {
    const res = await sendAppointmentMessage({ ...base, business: { ...business, wabaAccessToken: null }, kind: "confirmation", lastCustomerMessageAt: null });
    expect(res).toEqual({ ok: false, reason: "NO_WHATSAPP" });
  });
});
