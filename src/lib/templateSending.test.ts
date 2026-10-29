import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { fillVariables, templateBodyParams } from "./templateSending";

const ctx = { name: "Ana Pérez", appointmentAt: new Date("2026-11-02T20:30:00Z"), agendaUrl: "https://x.test/agenda", businessName: "Clínica Sol" };

describe("templateBodyParams", () => {
  it("sends nothing extra for a template without variables", () => {
    expect(templateBodyParams({ bodyText: "Hola, hay una promoción.", variableTags: null }, ctx)).toEqual({ ok: true, params: undefined, filledBody: "Hola, hay una promoción." });
  });

  it("fills each tag with this person's data, and keeps the filled message for the chat", () => {
    const r = templateBodyParams({ bodyText: "Hola {{1}}, tu cita es el {{2}} a las {{3}}. Gracias.", variableTags: ["nombre", "fecha", "hora"] }, ctx);
    expect(r).toEqual({ ok: true, params: ["Ana", "lunes 2 de noviembre", "3:30 pm"], filledBody: "Hola Ana, tu cita es el lunes 2 de noviembre a las 3:30 pm. Gracias." });
  });

  it("reports a person who lacks a piece, instead of sending a half message", () => {
    const r = templateBodyParams({ bodyText: "Hola {{1}}, tu cita es el {{2}}. Gracias.", variableTags: ["nombre", "fecha"] }, { name: "Ana" });
    expect(r).toEqual({ ok: false, error: "Falta una cita agendada" });
  });

  it("fills a lone variable of an older template with the name, and refuses to guess more", () => {
    expect(templateBodyParams({ bodyText: "Hola {{1}}, gracias.", variableTags: null }, ctx)).toMatchObject({ ok: true, params: ["Ana"] });
    expect(templateBodyParams({ bodyText: "Hola {{1}}, el {{2}}.", variableTags: null }, ctx)).toMatchObject({ ok: false });
  });
});

describe("fillVariables", () => {
  it("replaces each {{N}}", () => {
    expect(fillVariables("{{2}} y {{1}}", ["a", "b"])).toBe("b y a");
  });
});
