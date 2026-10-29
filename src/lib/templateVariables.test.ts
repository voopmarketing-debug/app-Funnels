import { describe, expect, it } from "vitest";
import { checkExamples, checkTemplateVariables, fillTemplateExamples, variableCount, variableNumbers } from "./templateVariables";

describe("variables in a template body", () => {
  it("counts them once each, in order", () => {
    expect(variableNumbers("Hola {{1}}, el {{2}} a las {{3}}. Adiós {{1}}.")).toEqual([1, 2, 3]);
    expect(variableCount("Sin variables")).toBe(0);
  });

  it("accepts a well-formed body, with or without variables", () => {
    expect(checkTemplateVariables("Hola {{1}}, tu cita es el {{2}} a las {{3}}. Gracias.")).toBeNull();
    expect(checkTemplateVariables("Hola 👋 Esta semana tenemos una promoción.")).toBeNull();
    expect(checkTemplateVariables("Hola {{ 1 }}, listo.")).toBeNull();
  });

  it.each([
    ["{{1}}, tu cita es mañana.", /empezar con una variable/],
    ["Tu cita es con {{1}}", /terminar con una variable/],
    ["Hola {{1}}, el {{3}} a las 5.", /desde 1 y sin saltarte/],
    ["Hola {{nombre}}, listo.", /con números/],
    ["Hola {{1}, listo.", /mal cerradas/],
  ])("explains what is wrong with %s", (body, message) => {
    expect(checkTemplateVariables(body)).toMatch(message);
  });

  it("wants one short single-line example per variable", () => {
    const body = "Hola {{1}}, el {{2}} a las {{3}}. Gracias.";
    expect(checkExamples(body, ["Ana", "lunes 2", "3:30 p. m."])).toBeNull();
    expect(checkExamples(body, ["Ana", "lunes 2"])).toMatch(/3 variables/);
    expect(checkExamples(body, ["Ana", "", "3:30"])).toMatch(/Falta el ejemplo/);
    expect(checkExamples(body, ["Ana", "a\nb", "3:30"])).toMatch(/una sola línea/);
    expect(checkExamples("Sin variables", [])).toBeNull();
  });

  it("fills the examples into the preview", () => {
    expect(fillTemplateExamples("Hola {{1}}, el {{2}}.", ["Ana", "lunes"])).toBe("Hola Ana, el lunes.");
    expect(fillTemplateExamples("Hola {{1}}, el {{2}}.", ["Ana"])).toBe("Hola Ana, el {{2}}.");
  });
});
