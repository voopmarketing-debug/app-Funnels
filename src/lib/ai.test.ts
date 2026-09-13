import { describe, expect, it } from "vitest";
import { stripLeadingGreeting } from "./ai";

describe("stripLeadingGreeting", () => {
  it("strips a leading exclamation greeting", () => {
    expect(stripLeadingGreeting("¡Hola! Un gusto, Agencia Patito.")).toBe("Un gusto, Agencia Patito.");
  });

  it("strips a plain 'Hola,' opener and re-capitalizes", () => {
    expect(stripLeadingGreeting("Hola, ¿cómo estás? contame más.")).toBe("¿cómo estás? contame más.");
  });

  it("strips a full 'buenas tardes' greeting, not just 'buenas'", () => {
    expect(stripLeadingGreeting("Buenas tardes! contame en que te ayudo")).toBe("Contame en que te ayudo");
  });

  it("strips 'hola de nuevo' as one phrase", () => {
    expect(stripLeadingGreeting("Hola de nuevo, seguimos con lo de ayer")).toBe("Seguimos con lo de ayer");
  });

  it("strips a leading emoji right after the greeting", () => {
    expect(stripLeadingGreeting("¡Hola! 👋 Qué bueno tenerte por acá")).toBe("Qué bueno tenerte por acá");
  });

  it("leaves a reply with no greeting untouched", () => {
    expect(stripLeadingGreeting("Perfecto, dame un segundo que reviso los precios.")).toBe(
      "Perfecto, dame un segundo que reviso los precios.",
    );
  });

  it("does not strip a word that merely starts with 'hola'", () => {
    expect(stripLeadingGreeting("Holamundo esto no debería romperse")).toBe(
      "Holamundo esto no debería romperse",
    );
  });

  it("falls back to the original text if the reply is only a greeting", () => {
    expect(stripLeadingGreeting("Hola")).toBe("Hola");
  });
});
