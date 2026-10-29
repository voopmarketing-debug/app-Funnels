import { describe, expect, it } from "vitest";
import { bodyWithExamples, bodyWithTags, convertTags, findTag, formatAppointmentWhen, readStoredTags, resolveTags } from "./templateTags";

describe("convertTags", () => {
  it("turns [nombre del lead] into the next variable, with an example for Meta", () => {
    const c = convertTags("Hola [nombre del lead], tu cita es el [fecha de la cita] a las [hora de la cita]. Gracias.");
    expect(c.body).toBe("Hola {{1}}, tu cita es el {{2}} a las {{3}}. Gracias.");
    expect(c.tags).toEqual(["nombre", "fecha", "hora"]);
    expect(c.examples).toEqual(["Ana", "lunes 2 de noviembre", "3:30 pm"]);
    expect(c.unrecognized).toEqual([]);
  });

  it("recognizes the names however they are typed", () => {
    expect(findTag("Nombre del Lead")).toBe("nombre");
    expect(findTag("  NOMBRE  ")).toBe("nombre");
    expect(findTag("día de la cita")).toBe("fecha");
    expect(findTag("Link de agenda")).toBe("enlace");
    expect(findTag("empresa")).toBe("negocio");
    expect(findTag("cumpleaños")).toBeNull();
  });

  it("reuses the number when a tag appears twice", () => {
    const c = convertTags("[nombre], hola [nombre]. Tu cita es [hora].");
    expect(c.body).toBe("{{1}}, hola {{1}}. Tu cita es {{2}}.");
    expect(c.tags).toEqual(["nombre", "hora"]);
  });

  it("leaves other bracketed text as written, and reports it", () => {
    const c = convertTags("[Oferta] Hola [nombre del lead], mira [esto]");
    expect(c.body).toBe("[Oferta] Hola {{1}}, mira [esto]");
    expect(c.unrecognized).toEqual(["[Oferta]", "[esto]"]);
  });

  it("does nothing to a message without tags", () => {
    expect(convertTags("Hola, tenemos una promoción.")).toEqual({ body: "Hola, tenemos una promoción.", tags: [], examples: [], unrecognized: [] });
  });
});

describe("showing a saved template", () => {
  it("writes the tags back, or the examples", () => {
    expect(bodyWithTags("Hola {{1}}, el {{2}}.", ["nombre", "fecha"])).toBe("Hola [nombre del lead], el [fecha de la cita].");
    expect(bodyWithExamples("Hola {{1}}, el {{2}}.", ["nombre", "fecha"])).toBe("Hola Ana, el lunes 2 de noviembre.");
    expect(bodyWithTags("Hola {{1}}.", null)).toBe("Hola {{1}}.");
  });
  it("reads the stored list only when it is a valid one", () => {
    expect(readStoredTags(["nombre", "hora"])).toEqual(["nombre", "hora"]);
    expect(readStoredTags(["nombre", "inventado"])).toBeNull();
    expect(readStoredTags(null)).toBeNull();
    expect(readStoredTags([])).toBeNull();
  });
});

describe("resolveTags", () => {
  const appointmentAt = new Date("2026-11-02T20:30:00Z"); // lunes 2 de noviembre, 3:30 pm in Bogotá
  const ctx = { name: "Ana María Pérez", appointmentAt, agendaUrl: "https://agente.funnelslabs.app/sitio/mi-agenda", businessName: "Clínica Sol" };

  it("fills every tag with that person's data", () => {
    const r = resolveTags(["nombre", "fecha", "hora", "enlace", "negocio", "nombre_completo"], ctx);
    expect(r).toEqual({ ok: true, values: ["Ana", "lunes 2 de noviembre", "3:30 pm", "https://agente.funnelslabs.app/sitio/mi-agenda", "Clínica Sol", "Ana María Pérez"] });
  });
  it("calls someone without a name 'cliente'", () => {
    expect(resolveTags(["nombre"], { ...ctx, name: null })).toEqual({ ok: true, values: ["cliente"] });
  });
  it("reports a date, hour or link the person doesn't have, instead of inventing one", () => {
    expect(resolveTags(["nombre", "fecha"], { name: "Ana" })).toMatchObject({ ok: false, missing: "fecha" });
    expect(resolveTags(["enlace"], { name: "Ana" })).toMatchObject({ ok: false, missing: "enlace" });
  });
  it("writes the hour without the dots that would double up with a full stop", () => {
    expect(formatAppointmentWhen(appointmentAt, "America/Bogota")).toEqual({ date: "lunes 2 de noviembre", time: "3:30 pm" });
  });
});
