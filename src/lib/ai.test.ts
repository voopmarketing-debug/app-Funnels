import { describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
vi.mock("./anthropicClient", () => ({
  anthropic: { messages: { create: (...args: unknown[]) => createMock(...args) } },
}));

const { stripGreetings, generateAgentReply, buildTurnContext } = await import("./ai");

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

    const requestArg = createMock.mock.calls[0][0] as {
      tools: { name: string }[];
      system: { text: string }[];
      messages: { role: string; content: string | { type: string; text?: string; cache_control?: unknown }[] }[];
    };
    expect(requestArg.tools.map((t) => t.name)).toContain("mark_appointment");
    // The clock rides on the latest turn, so it never breaks the cached prefix.
    expect(requestArg.system[1].text).not.toContain("FECHA Y HORA ACTUAL");
    const lastTurn = requestArg.messages.at(-1)!.content as { text?: string }[];
    expect(lastTurn.some((b) => b.text?.includes("FECHA Y HORA ACTUAL"))).toBe(true);
    // History goes once, as messages (not repeated in the system prompt), with
    // a cache breakpoint on the previous message.
    expect(requestArg.system[1].text).not.toContain("Hola, quiero agendar una valoración");
    const previous = requestArg.messages.at(-2)!.content as { text: string; cache_control?: unknown }[];
    expect(previous[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
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

  it("puts the catalog in the cached block, marking sold-out products without unit counts", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "Los audífonos cuestan $299.000." }],
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });

    await generateAgentReply({
      systemPrompt: "Eres el agente de una tienda.",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [],
      userMessage: "¿Cuánto valen los audífonos?",
      catalog: [
        { name: "Audífonos Aero", price: 299000, compareAtPrice: 350000, currency: "COP", category: "Audio", description: "Bluetooth 5.3", soldOut: false },
        { name: "Parlante Mini", price: 129000, compareAtPrice: null, currency: "COP", category: null, description: "", soldOut: true },
      ],
    });

    const requestArg = createMock.mock.calls.at(-1)![0] as { system: { text: string; cache_control?: unknown }[] };
    const cached = requestArg.system[0];
    expect(cached.cache_control).toBeDefined();
    expect(cached.text).toContain("Audífonos Aero — $299.000 (antes $350.000) · Audio · Bluetooth 5.3");
    expect(cached.text).toContain("Parlante Mini — $129.000 · AGOTADO");
    expect(requestArg.system[1].text).not.toContain("CATÁLOGO");
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

describe("generateAgentReply — photos and empty content", () => {
  const okResponse = {
    content: [{ type: "text", text: "¡Qué linda foto! ¿En qué te puedo ayudar?" }],
    usage: { input_tokens: 10, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };
  type SentMessage = { role: string; content: string | { type: string; text?: string; source?: { data: string } }[] };

  it("never sends an empty turn for a caption-less photo (the API rejects it with a 400)", async () => {
    createMock.mockResolvedValueOnce(okResponse);

    await generateAgentReply({
      systemPrompt: "Eres el agente de una agencia.",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "" }, // e.g. a media-only reply stored with no caption
      ],
      userMessage: "",
      userImages: [{ mediaType: "image/jpeg", data: "BASE64DATA" }],
    });

    const { messages } = createMock.mock.calls.at(-1)![0] as { messages: SentMessage[] };
    for (const m of messages) {
      const text = typeof m.content === "string" ? m.content : m.content.map((b) => b.text ?? b.source?.data ?? "").join("");
      expect(text.trim()).not.toBe("");
    }

    const last = messages.at(-1)!;
    expect(Array.isArray(last.content)).toBe(true);
    const blocks = last.content as { type: string; text?: string; source?: { data: string } }[];
    expect(blocks[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "BASE64DATA" } });
    expect(blocks.at(-1)!.type).toBe("text");
    expect(blocks.at(-1)!.text).toContain("imagen");
  });

  it("keeps a real caption as the text next to the photo", async () => {
    createMock.mockResolvedValueOnce(okResponse);

    await generateAgentReply({
      systemPrompt: "Eres el agente de una agencia.",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [],
      userMessage: "¿Cuánto cuesta algo así?",
      userImages: [{ mediaType: "image/png", data: "X" }],
    });

    const { messages } = createMock.mock.calls.at(-1)![0] as { messages: SentMessage[] };
    const blocks = messages.at(-1)!.content as { type: string; text?: string }[];
    expect(blocks.at(-1)).toEqual({ type: "text", text: "¿Cuánto cuesta algo así?" });
  });
});

describe("generateAgentReply — move_lead_stage tool", () => {
  const base = {
    systemPrompt: "Eres el agente de una tienda.",
    tone: "cercano",
    replyLength: "breve",
    industry: "otro",
    model: "claude-sonnet-5",
    history: [{ role: "user" as const, content: "Hola, ¿cuánto vale la camiseta?" }],
    userMessage: "Listo, ya te transferí",
    funnel: { stages: ["Nuevo", "En conversación", "Interesado", "Ganado", "Perdido"], current: "Interesado" },
  };
  const usage = { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

  it("offers the funnel's stages, tells the model where the lead is, and returns the chosen stage", async () => {
    createMock.mockReset();
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: "¡Gracias! Ya mismo preparamos tu pedido." },
        { type: "tool_use", id: "toolu_1", name: "move_lead_stage", input: { stage: "Ganado" } },
      ],
      usage,
    });
    const result = await generateAgentReply(base);
    expect(result.stage).toBe("Ganado");
    expect(createMock).toHaveBeenCalledTimes(1);
    const req = createMock.mock.calls[0][0] as { tools: { name: string; input_schema: { properties: { stage?: { enum: string[] } } } }[]; system: { text: string }[] };
    const tool = req.tools.find((t) => t.name === "move_lead_stage");
    expect(tool?.input_schema.properties.stage?.enum).toEqual(base.funnel.stages);
    expect(req.system[1].text).toContain('ETAPA ACTUAL DEL CLIENTE EN EL EMBUDO: "Interesado"');
  });

  it("ignores a stage that isn't in the funnel", async () => {
    createMock.mockReset();
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Perfecto." },
        { type: "tool_use", id: "toolu_1", name: "move_lead_stage", input: { stage: "VIP" } },
      ],
      usage,
    });
    expect((await generateAgentReply(base)).stage).toBeUndefined();
  });

  it("asks for the text when the model only moved the stage, instead of sending a filler", async () => {
    createMock.mockReset();
    createMock
      .mockResolvedValueOnce({ content: [{ type: "tool_use", id: "toolu_1", name: "move_lead_stage", input: { stage: "Ganado" } }], usage })
      .mockResolvedValueOnce({ content: [{ type: "text", text: "¡Gracias por tu compra!" }], usage });
    const result = await generateAgentReply(base);
    expect(result.text).toBe("¡Gracias por tu compra!");
    expect(result.stage).toBe("Ganado");
    expect(result.usage.inputTokens).toBe(200);
    const second = createMock.mock.calls[1][0] as { tool_choice: { type: string }; messages: { role: string; content: unknown }[] };
    expect(second.tool_choice).toEqual({ type: "none" });
    expect(second.messages.at(-1)).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "Listo." }] });
  });

  it("doesn't offer the tool without a funnel", async () => {
    createMock.mockReset();
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: "Hola" }], usage });
    await generateAgentReply({ ...base, funnel: undefined });
    const req = createMock.mock.calls[0][0] as { tools: { name: string }[] };
    expect(req.tools.map((t) => t.name)).not.toContain("move_lead_stage");
  });
});

describe("buildTurnContext", () => {
  const now = new Date("2026-10-09T15:00:00Z"); // 10:00 Bogotá

  it("tells the model a booked time already passed, so it never says 'nos vemos' for it", () => {
    const text = buildTurnContext({ appointmentAt: new Date("2026-10-09T13:00:00Z"), appointmentNote: "Demo" }, now);
    expect(text).toContain("YA PASÓ");
    expect(text).toContain("reagendar");
  });

  it("keeps an upcoming appointment as upcoming", () => {
    const text = buildTurnContext({ appointmentAt: new Date("2026-10-10T13:00:00Z") }, now);
    expect(text).toContain("tiene una cita agendada");
    expect(text).not.toContain("YA PASÓ");
  });

  it("asks for a warm greeting only after more than a day of silence", () => {
    expect(buildTurnContext({ lastActivityAt: new Date("2026-10-07T15:00:00Z") }, now)).toContain("saluda de nuevo");
    expect(buildTurnContext({ lastActivityAt: new Date("2026-10-09T10:00:00Z") }, now)).not.toContain("saluda de nuevo");
  });

  it("passes the CRM name to use exactly, but not junk profile names", () => {
    expect(buildTurnContext({ contactName: "Juan Camilo" }, now)).toContain('NOMBRE DEL CLIENTE en el CRM: "Juan Camilo"');
    expect(buildTurnContext({ contactName: "🔥🔥" }, now)).not.toContain("NOMBRE DEL CLIENTE");
    expect(buildTurnContext({ contactName: "+57 300 123 4567" }, now)).not.toContain("NOMBRE DEL CLIENTE");
  });
});

describe("greetings after a long gap", () => {
  it("keeps the greeting when the customer comes back after more than a day", async () => {
    createMock.mockReset();
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "¡Hola de nuevo, Juan! Seguimos con tu demo." }],
      usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });
    const result = await generateAgentReply({
      systemPrompt: "x",
      tone: "cercano",
      replyLength: "breve",
      industry: "otro",
      model: "claude-sonnet-5",
      history: [{ role: "assistant", content: "¿Te sirve el jueves?" }],
      userMessage: "Hola, sigo interesado",
      turn: { lastActivityAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    });
    expect(result.text).toBe("¡Hola de nuevo, Juan! Seguimos con tu demo.");
  });
});
