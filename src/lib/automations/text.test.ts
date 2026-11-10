import { describe, expect, it } from "vitest";
import { evaluateRules, matchesChoice, matchesTrigger, renderText, validateAnswer, type LeadView } from "./text";

const lead = (over: Partial<LeadView> = {}): LeadView => ({
  name: "Ana María Pérez",
  phone: "573001112233",
  email: null,
  tags: ["VIP"],
  stageId: "st1",
  appointmentAt: new Date("2026-11-02T20:30:00Z"),
  lastText: "Quiero información",
  businessName: "Clínica Sol",
  agendaUrl: "https://x.test/agenda",
  timeZone: "America/Bogota",
  hour: 15,
  ...over,
});

describe("renderText", () => {
  it("fills the same tags as the templates, plus phone and e-mail", () => {
    expect(renderText("Hola [nombre del lead], tu cita es el [fecha de la cita] a las [hora de la cita]. [Teléfono]", lead())).toBe("Hola Ana, tu cita es el lunes 2 de noviembre a las 3:30 pm. 573001112233");
    expect(renderText("[correo]", lead({ email: "a@b.co" }))).toBe("a@b.co");
  });
  it("drops a tag with nothing to fill it and leaves other brackets alone", () => {
    expect(renderText("Cita: [fecha de la cita].", lead({ appointmentAt: null }))).toBe("Cita: .");
    expect(renderText("[Oferta] hoy", lead())).toBe("[Oferta] hoy");
    expect(renderText("Hola [nombre]", lead({ name: null }))).toBe("Hola cliente");
  });
});

describe("validateAnswer", () => {
  it("email", () => {
    expect(validateAnswer("email", " Ana@Correo.COM ")).toEqual({ ok: true, value: "ana@correo.com" });
    expect(validateAnswer("email", "ana@correo")).toEqual({ ok: false });
  });
  it("phone", () => {
    expect(validateAnswer("phone", "+57 (300) 111-2233")).toEqual({ ok: true, value: "+573001112233" });
    expect(validateAnswer("phone", "123")).toEqual({ ok: false });
  });
  it("number", () => {
    expect(validateAnswer("number", "12,5")).toEqual({ ok: true, value: "12.5" });
    expect(validateAnswer("number", "doce")).toEqual({ ok: false });
  });
  it("date, in the formats people write", () => {
    expect(validateAnswer("date", "25/12/2026")).toEqual({ ok: true, value: "2026-12-25" });
    expect(validateAnswer("date", "2026-1-5")).toEqual({ ok: true, value: "2026-01-05" });
    expect(validateAnswer("date", "31/02/2026")).toEqual({ ok: false });
    expect(validateAnswer("date", "mañana")).toEqual({ ok: false });
  });
  it("text and empty", () => {
    expect(validateAnswer("text", "Juan")).toEqual({ ok: true, value: "Juan" });
    expect(validateAnswer("text", "  ")).toEqual({ ok: false });
  });
});

describe("conditions", () => {
  it("reads tags, stage, message, hour and what the lead has", () => {
    const l = lead();
    expect(evaluateRules("all", [{ field: "tag", op: "has", value: "vip" }, { field: "stage", op: "is", value: "st1" }], l)).toBe(true);
    expect(evaluateRules("all", [{ field: "tag", op: "has_not", value: "VIP" }], l)).toBe(false);
    expect(evaluateRules("any", [{ field: "message", op: "contains", value: "INFORMACION" }, { field: "email", op: "exists" }], l)).toBe(true);
    expect(evaluateRules("all", [{ field: "hour", op: "gte", value: 9 }, { field: "hour", op: "lte", value: 18 }], l)).toBe(true);
    expect(evaluateRules("all", [{ field: "hour", op: "gte", value: 16 }], l)).toBe(false);
    expect(evaluateRules("all", [{ field: "appointment", op: "missing" }, { field: "email", op: "missing" }], l)).toBe(false);
  });
});

describe("triggers", () => {
  it("matches keywords as whole words, ignoring case, accents and punctuation", () => {
    const t = { type: "message" as const, keywords: ["precio", "cuánto cuesta"] };
    expect(matchesTrigger(t, { type: "message", text: "¿Cuánto cuesta el blanqueamiento?" })).toBe(true);
    expect(matchesTrigger(t, { type: "message", text: "PRECIOS" })).toBe(false);
    expect(matchesTrigger(t, { type: "message", text: "Precio?" })).toBe(true);
    expect(matchesTrigger({ ...t, match: "exact" }, { type: "message", text: "Precio" })).toBe(true);
    expect(matchesTrigger({ ...t, match: "exact" }, { type: "message", text: "Precio por favor" })).toBe(false);
  });
  it("matches the other events", () => {
    expect(matchesTrigger({ type: "new_conversation" }, { type: "new_conversation" })).toBe(true);
    expect(matchesTrigger({ type: "new_conversation" }, { type: "message", text: "hola" })).toBe(false);
    expect(matchesTrigger({ type: "stage_changed", stageId: "s2" }, { type: "stage_changed", stageId: "s2" })).toBe(true);
    expect(matchesTrigger({ type: "stage_changed", stageId: "s2" }, { type: "stage_changed", stageId: "s3" })).toBe(false);
    expect(matchesTrigger({ type: "tag_added", tag: "Caliente" }, { type: "tag_added", tag: "caliente" })).toBe(true);
  });
  it("matches a tapped button by id or by its text", () => {
    expect(matchesChoice({ id: "si", title: "Sí, quiero" }, { text: "algo", replyId: "si" })).toBe(true);
    expect(matchesChoice({ id: "si", title: "Sí, quiero" }, { text: "sí, quiero" })).toBe(true);
    expect(matchesChoice({ id: "si", title: "Sí, quiero" }, { text: "no" })).toBe(false);
  });
});
