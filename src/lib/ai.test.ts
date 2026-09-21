import { describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("./anthropicClient", () => ({
  anthropic: { messages: { create: (...args: unknown[]) => createMock(...args) } },
}));

const { stripGreetings, generateAgentReply } = await import("./ai");

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

describe("generateAgentReply — mark_appointment tool", () => {
  it("parses a valid appointment tool_use block and includes the current-date context", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Perfecto, quedas agendado para el jueves a las 3pm." },
        {
          type: "tool_use",
          id: "toolu_test",
          name: "mark_appointment",
          input: { appointmentAt: "2026-09-25T15:00:00-05:00", note: "Valoración estética" },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });

    const result = await generateAgentReply({
      systemPrompt: "Eres el agente de una clínica.",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [
        { role: "user", content: "Hola, quiero agendar una valoración" },
        { role: "assistant", content: "Claro, ¿qué día te queda bien? Jueves 3pm o viernes 10am." },
      ],
      userMessage: "Sí, el jueves a las 3pm me sirve perfecto",
    });

    expect(result.appointment).toEqual({ at: "2026-09-25T15:00:00-05:00", note: "Valoración estética" });
    expect(result.text).toContain("agendado");

    const requestArg = createMock.mock.calls[0][0] as { tools: { name: string }[]; system: { text: string }[] };
    expect(requestArg.tools.map((t) => t.name)).toContain("mark_appointment");
    expect(requestArg.system[1].text).toContain("FECHA Y HORA ACTUAL");
  });

  it("discards a malformed appointment date instead of crashing", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Listo, te aviso." },
        {
          type: "tool_use",
          id: "toolu_test2",
          name: "mark_appointment",
          input: { appointmentAt: "no-es-una-fecha", note: "algo" },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });

    const result = await generateAgentReply({
      systemPrompt: "Eres el agente de una clínica.",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [],
      userMessage: "algo",
    });

    expect(result.appointment).toBeUndefined();
    expect(result.text).toBeTruthy();
  });

  it("always offers the mark_appointment tool even with no media available", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hola, ¿en qué te ayudo?" }],
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });

    await generateAgentReply({
      systemPrompt: "Eres el agente de una clínica.",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [],
      userMessage: "Hola",
    });

    const requestArg = createMock.mock.calls[0][0] as { tools: { name: string }[] };
    expect(requestArg.tools).toHaveLength(1);
    expect(requestArg.tools[0].name).toBe("mark_appointment");
  });
});
