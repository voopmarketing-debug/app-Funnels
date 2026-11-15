import { describe, expect, it } from "vitest";
import { ADVANCED_AGENT_MODEL, AUTO_AGENT_MODEL, ECONOMY_REPLY_MODEL, resolveAgentModel } from "./agentModelRouting";

const turn = (text: string, over: Partial<{ hasImages: boolean; customerMessages: number }> = {}) => ({ text, hasImages: false, customerMessages: 1, ...over });
const auto = (text: string, over = {}) => resolveAgentModel(AUTO_AGENT_MODEL, turn(text, over));

describe("resolveAgentModel", () => {
  it("returns a fixed model as it is, whatever the message", () => {
    expect(resolveAgentModel("claude-sonnet-5", turn("hola"))).toBe("claude-sonnet-5");
    expect(resolveAgentModel("claude-haiku-4-5", turn("¿cuánto cuesta?"))).toBe("claude-haiku-4-5");
  });

  it.each(["hola", "Hola, buenas tardes", "Buenos días 🙂", "gracias", "Muchas gracias!", "ok perfecto", "👍", "🙏🙏", "listo, gracias"])(
    "uses the economical model for small talk: %s",
    (text) => expect(auto(text)).toBe(ECONOMY_REPLY_MODEL),
  );

  it.each(["¿Dónde están ubicados?", "¿Atienden los domingos?", "¿Tienen parqueadero?", "cuéntame más del servicio"])(
    "uses the economical model for a quick question with no buying signal: %s",
    (text) => expect(auto(text)).toBe(ECONOMY_REPLY_MODEL),
  );

  it.each([
    "¿Cuánto cuesta el blanqueamiento?",
    "Quiero agendar una cita",
    "me interesa el plan pro",
    "¿Tienen disponibilidad el jueves?",
    "Ya hice la transferencia",
    "Tengo un problema con mi pedido",
    "Quisiera cambiar mi cita",
    "mi número es 3001234567",
    "¿Me dan descuento si pago hoy?",
    "Necesito una factura",
  ])("uses the advanced model when money, booking or a complaint shows up: %s", (text) => expect(auto(text)).toBe(ADVANCED_AGENT_MODEL));

  it("uses the advanced model for a photo, whatever it says", () => {
    expect(auto("", { hasImages: true })).toBe(ADVANCED_AGENT_MODEL);
    expect(auto("gracias", { hasImages: true })).toBe(ADVANCED_AGENT_MODEL);
  });

  it("uses the advanced model for a long message", () => {
    expect(auto("La verdad estoy pensando en varias opciones y quisiera entender bien cómo funciona todo el proceso desde el principio, qué incluye, cuánto tiempo toma y quién me atendería durante las sesiones, porque la última vez que probé algo parecido no me fue bien y no quiero repetirlo.")).toBe(ADVANCED_AGENT_MODEL);
  });

  it("moves an engaged conversation to the advanced model, but a plain thank-you still uses the economical one", () => {
    expect(auto("cuéntame más del servicio", { customerMessages: 6 })).toBe(ADVANCED_AGENT_MODEL);
    expect(auto("cuéntame más del servicio", { customerMessages: 5 })).toBe(ECONOMY_REPLY_MODEL);
    expect(auto("gracias", { customerMessages: 12 })).toBe(ECONOMY_REPLY_MODEL);
  });
});
