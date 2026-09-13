import { describe, expect, it } from "vitest";
import { stripGreetings } from "./ai";

describe("stripGreetings", () => {
  it("leaves the first message of a conversation untouched", () => {
    expect(stripGreetings("¡Hola! Bienvenido, contame en qué te ayudo", true)).toBe(
      "¡Hola! Bienvenido, contame en qué te ayudo",
    );
  });

  it("strips a leading exclamation greeting", () => {
    expect(stripGreetings("¡Hola! Un gusto, Agencia Patito.", false)).toBe("Un gusto, Agencia Patito.");
  });

  it("strips a plain 'Hola,' opener and re-capitalizes", () => {
    expect(stripGreetings("Hola, ¿cómo estás? contame más.", false)).toBe("¿cómo estás? contame más.");
  });

  it("strips a full 'buenas tardes' greeting, not just 'buenas'", () => {
    expect(stripGreetings("Buenas tardes! contame en que te ayudo", false)).toBe("Contame en que te ayudo");
  });

  it("strips 'hola de nuevo' as one phrase", () => {
    expect(stripGreetings("Hola de nuevo, seguimos con lo de ayer", false)).toBe("Seguimos con lo de ayer");
  });

  it("strips a leading emoji right after the greeting", () => {
    expect(stripGreetings("¡Hola! 👋 Qué bueno tenerte por acá", false)).toBe("Qué bueno tenerte por acá");
  });

  it("strips a greeting buried mid-sentence and turns it into a period", () => {
    expect(
      stripGreetings(
        "¡Perfecto, buenas noches! Para armar bien tu propuesta, contame cómo te llamás.",
        false,
      ),
    ).toBe("¡Perfecto. Para armar bien tu propuesta, contame cómo te llamás.");
  });

  it("strips a greeting addressed with the customer's name, and the delay apology right after it", () => {
    expect(stripGreetings("¡Buenas noches, Juan Camilo! Disculpa la demora.", false)).toBe("Juan Camilo!");
  });

  it("strips a leading delay apology", () => {
    expect(
      stripGreetings("Perdona la demora, ya quedó todo funcionando de nuestro lado.", false),
    ).toBe("Ya quedó todo funcionando de nuestro lado.");
  });

  it("strips 'perdón por la demora' mid-sentence without leaving a stray period", () => {
    expect(
      stripGreetings("Perdón por la demora, parece que hubo un problema técnico ahí.", false),
    ).toBe("Parece que hubo un problema técnico ahí.");
  });

  it("does not touch 'demora' used as a normal noun unrelated to an apology", () => {
    expect(stripGreetings("Tenemos productos con gran demora en llegar por la aduana.", false)).toBe(
      "Tenemos productos con gran demora en llegar por la aduana.",
    );
  });

  it("does not touch 'buenas' used as a normal adjective", () => {
    expect(stripGreetings("Tengo buenas noticias para ti sobre el descuento.", false)).toBe(
      "Tengo buenas noticias para ti sobre el descuento.",
    );
    expect(stripGreetings("Nuestros resultados han sido muy buenos este mes.", false)).toBe(
      "Nuestros resultados han sido muy buenos este mes.",
    );
  });

  it("leaves a reply with no greeting untouched", () => {
    expect(stripGreetings("Perfecto, dame un segundo que reviso los precios.", false)).toBe(
      "Perfecto, dame un segundo que reviso los precios.",
    );
  });

  it("does not strip a word that merely starts with 'hola'", () => {
    expect(stripGreetings("Holamundo esto no debería romperse", false)).toBe(
      "Holamundo esto no debería romperse",
    );
  });

  it("falls back to the original text if the reply is only a greeting", () => {
    expect(stripGreetings("Hola", false)).toBe("Hola");
  });
});
