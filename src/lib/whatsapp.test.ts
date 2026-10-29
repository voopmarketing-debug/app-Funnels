import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNREADABLE_PREFIX, inspectWabaToken, listWabaPhoneNumbers, parseInboundMessages, verifyWebhookSignature } from "./whatsapp";

describe("verifyWebhookSignature", () => {
  const appSecret = "test-app-secret";

  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");

    expect(verifyWebhookSignature(body, signature, appSecret)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");

    expect(verifyWebhookSignature(body + "tampered", signature, appSecret)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyWebhookSignature("{}", null, appSecret)).toBe(false);
    expect(verifyWebhookSignature("{}", "not-a-signature", appSecret)).toBe(false);
  });
});

describe("parseInboundMessages", () => {
  it("extracts text messages with the business's phone_number_id", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                contacts: [{ profile: { name: "Juan Pérez" } }],
                messages: [
                  { id: "wamid.1", from: "5219990000000", type: "text", text: { body: "Hola" } },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseInboundMessages(payload);

    expect(messages).toEqual([
      {
        phoneNumberId: "1234567890",
        from: "5219990000000",
        contactName: "Juan Pérez",
        text: "Hola",
        whatsappMsgId: "wamid.1",
      },
    ]);
  });

  it("ignores non-text messages and status updates", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                statuses: [{ id: "wamid.2", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };

    expect(parseInboundMessages(payload)).toEqual([]);
  });

  it("turns buttons, locations, contacts and stickers into readable text, and skips reactions", () => {
    const msg = (id: string, extra: Record<string, unknown>) => ({ id, from: "573001234567", ...extra });
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                messages: [
                  msg("w1", { type: "button", button: { text: "Sí, me interesa" } }),
                  msg("w2", { type: "interactive", interactive: { type: "list_reply", list_reply: { title: "Plan anual" } } }),
                  msg("w3", { type: "location", location: { latitude: 4.6, longitude: -74.08, name: "Oficina" } }),
                  msg("w4", {
                    type: "contacts",
                    contacts: [{ name: { formatted_name: "Ana" }, phones: [{ phone: "+57 300 111 2233" }] }],
                  }),
                  msg("w5", { type: "sticker", sticker: { id: "s1" } }),
                  msg("w6", { type: "reaction", reaction: { emoji: "👍", message_id: "w1" } }),
                  msg("w7", { type: "unsupported", errors: [{ code: 131051, title: "Message type unknown" }] }),
                ],
              },
            },
          ],
        },
      ],
    };

    const parsed = parseInboundMessages(payload);
    expect(parsed.map((m) => m.text)).toEqual([
      "Sí, me interesa",
      "Plan anual",
      "[Ubicación compartida: Oficina] https://maps.google.com/?q=4.6,-74.08",
      "[Contacto compartido: Ana +57 300 111 2233]",
      "[Sticker]",
      expect.stringContaining("Puede ser publicidad de otra empresa"),
    ]);
    // Only the message with no content is kept away from the AI.
    expect(parsed.map((m) => !!m.unreadable)).toEqual([false, false, false, false, false, true]);
  });

  it("marks content-less buttons and unknown types as unreadable", () => {
    const msg = (id: string, extra: Record<string, unknown>) => ({ id, from: "573001234567", ...extra });
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                messages: [
                  msg("u1", { type: "button", button: { payload: "PROMO" } }),
                  msg("u2", { type: "interactive", interactive: { type: "nfm_reply" } }),
                  msg("u3", { type: "order", order: {} }),
                ],
              },
            },
          ],
        },
      ],
    };
    const parsed = parseInboundMessages(payload);
    expect(parsed.every((m) => m.unreadable && m.text.startsWith(UNREADABLE_PREFIX))).toBe(true);
    expect(parsed[2].text).toContain('"order"');
  });

  it("accepts a new contact who hides their number behind a WhatsApp username (BSUID only)", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                contacts: [{ profile: { name: "Laura" }, user_id: "CO.1A2B3C4D5E" }],
                messages: [{ id: "wamid.9", from_user_id: "CO.1A2B3C4D5E", type: "text", text: { body: "hola" } }],
              },
            },
          ],
        },
      ],
    };
    expect(parseInboundMessages(payload)).toEqual([
      { phoneNumberId: "1234567890", from: "CO.1A2B3C4D5E", contactName: "Laura", whatsappMsgId: "wamid.9", text: "hola" },
    ]);
  });

  it("still prefers the phone number when Meta sends both it and a BSUID", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1234567890" },
                contacts: [{ profile: { name: "Ana" }, wa_id: "573001234567", user_id: "CO.ZZZ999" }],
                messages: [{ id: "wamid.10", from: "573001234567", user_id: "CO.ZZZ999", type: "text", text: { body: "hola" } }],
              },
            },
          ],
        },
      ],
    };
    expect(parseInboundMessages(payload)[0].from).toBe("573001234567");
  });

  it("returns an empty array for malformed payloads", () => {
    expect(parseInboundMessages(null)).toEqual([]);
    expect(parseInboundMessages({})).toEqual([]);
  });
});

describe("inspectWabaToken / listWabaPhoneNumbers", () => {
  const realFetch = globalThis.fetch;
  const ENV = { id: process.env.META_APP_ID, secret: process.env.META_APP_SECRET };

  beforeEach(() => {
    process.env.META_APP_ID = "app1";
    process.env.META_APP_SECRET = "sec1";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.META_APP_ID = ENV.id;
    process.env.META_APP_SECRET = ENV.secret;
  });

  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("reads the accounts and a permanent token from Meta's debug endpoint", async () => {
    const fake = reply({
      data: {
        is_valid: true,
        expires_at: 0,
        scopes: ["whatsapp_business_messaging"],
        granular_scopes: [
          { scope: "whatsapp_business_management", target_ids: ["W1", "W2"] },
          { scope: "whatsapp_business_messaging", target_ids: ["W1"] },
          { scope: "business_management" },
        ],
      },
    });
    globalThis.fetch = fake as unknown as typeof fetch;
    const info = await inspectWabaToken("tok");
    expect(info).toEqual({ ok: true, expiresAt: null, wabaIds: ["W1", "W2"], scopes: ["whatsapp_business_messaging"] });
    const called = String((fake.mock.calls as unknown as unknown[][])[0][0]);
    expect(called).toContain("debug_token");
    expect(called).toContain("input_token=tok");
  });

  it("reports an expiry date for a temporary token", async () => {
    globalThis.fetch = reply({ data: { is_valid: true, expires_at: 1_900_000_000, granular_scopes: [] } }) as unknown as typeof fetch;
    const info = await inspectWabaToken("tok");
    expect(info.ok && info.expiresAt?.getTime()).toBe(1_900_000_000_000);
  });

  it("says so when the token is expired or unknown", async () => {
    globalThis.fetch = reply({ data: { is_valid: false } }) as unknown as typeof fetch;
    expect(await inspectWabaToken("tok")).toMatchObject({ ok: false, error: expect.stringContaining("venció") });
    globalThis.fetch = reply({ error: { message: "bad" } }, 400) as unknown as typeof fetch;
    expect(await inspectWabaToken("tok")).toMatchObject({ ok: false });
  });

  it("lists the numbers of an account", async () => {
    globalThis.fetch = reply({ data: [{ id: "P1", display_phone_number: "+57 300 1112233", verified_name: "Funnels" }] }) as unknown as typeof fetch;
    expect(await listWabaPhoneNumbers({ wabaId: "W1", accessToken: "tok" })).toEqual([
      { phoneNumberId: "P1", displayPhoneNumber: "+57 300 1112233", verifiedName: "Funnels", wabaId: "W1" },
    ]);
    globalThis.fetch = reply({ error: {} }, 403) as unknown as typeof fetch;
    expect(await listWabaPhoneNumbers({ wabaId: "W1", accessToken: "tok" })).toEqual([]);
  });
});

describe("template sends and Meta errors", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("sends the body variables in order, cleaned up for Meta", async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.T" }] }), { status: 200 }));
    globalThis.fetch = fake as unknown as typeof fetch;
    const { sendWhatsAppTemplateMessage } = await import("./whatsapp");
    const res = await sendWhatsAppTemplateMessage({
      phoneNumberId: "P1",
      accessToken: "tok",
      to: "573001234567",
      templateName: "confirmacion_cita",
      language: "es",
      bodyParams: ["Ana", "lunes 2 de noviembre", "3:30 p. m.\n"],
    });
    expect(res.messageId).toBe("wamid.T");
    const body = JSON.parse(String((fake.mock.calls as unknown as [string, RequestInit][])[0][1].body));
    expect(body.template.components).toEqual([
      { type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "lunes 2 de noviembre" }, { type: "text", text: "3:30 p. m." }] },
    ]);
  });

  it("cleans template variables Meta would refuse", async () => {
    const { sanitizeTemplateParam } = await import("./whatsapp");
    expect(sanitizeTemplateParam("a\nb\t c")).toBe("a b c");
    expect(sanitizeTemplateParam("   ")).toBe("-");
  });

  it("throws a classified error with Meta's code, without the token in it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Error validating access token", code: 190 } }), { status: 401 })) as unknown as typeof fetch;
    const { sendWhatsAppTextMessage } = await import("./whatsapp");
    const { WhatsAppApiError } = await import("./whatsappErrors");
    const err = await sendWhatsAppTextMessage({ phoneNumberId: "P1", accessToken: "SECRET-TOKEN", to: "573001234567", text: "hola" }).catch((e) => e);
    expect(err).toBeInstanceOf(WhatsAppApiError);
    expect(err.kind).toBe("TOKEN_INVALID");
    expect(err.code).toBe(190);
    expect(err.message).not.toContain("SECRET-TOKEN");
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRET-TOKEN");
    expect(logged).toContain("TOKEN_INVALID");
  });
});

describe("parseTemplateStatusUpdates", () => {
  it("reads approvals and rejections for a WABA", async () => {
    const { parseTemplateStatusUpdates } = await import("./whatsapp");
    const payload = {
      entry: [
        {
          id: "WABA1",
          changes: [
            { field: "message_template_status_update", value: { event: "APPROVED", message_template_name: "confirmacion_cita", message_template_language: "es", reason: "NONE" } },
            { field: "message_template_status_update", value: { event: "REJECTED", message_template_name: "link_agendamiento", reason: "INVALID_FORMAT" } },
            { field: "messages", value: { messages: [] } },
          ],
        },
      ],
    };
    expect(parseTemplateStatusUpdates(payload)).toEqual([
      { wabaId: "WABA1", name: "confirmacion_cita", language: "es", event: "APPROVED", reason: undefined },
      { wabaId: "WABA1", name: "link_agendamiento", language: undefined, event: "REJECTED", reason: "INVALID_FORMAT" },
    ]);
  });

  it("ignores junk without throwing", async () => {
    const { parseTemplateStatusUpdates } = await import("./whatsapp");
    expect(parseTemplateStatusUpdates(null)).toEqual([]);
    expect(parseTemplateStatusUpdates({ entry: [{ changes: [{ field: "message_template_status_update", value: {} }] }] })).toEqual([]);
  });
});

describe("createWhatsAppTemplate with variables", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("sends an example for each body variable", async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ id: "T1", status: "PENDING" }), { status: 200 }));
    globalThis.fetch = fake as unknown as typeof fetch;
    const { createWhatsAppTemplate } = await import("./whatsapp");
    await createWhatsAppTemplate({ wabaId: "W1", accessToken: "t", name: "confirmacion_cita", language: "es", category: "UTILITY", bodyText: "Hola {{1}}, el {{2}}. Gracias.", bodyExamples: ["Ana", "lunes"] });
    const body = JSON.parse(String((fake.mock.calls as unknown as [string, RequestInit][])[0][1].body));
    expect(body.components[0]).toEqual({ type: "BODY", text: "Hola {{1}}, el {{2}}. Gracias.", example: { body_text: [["Ana", "lunes"]] } });
  });

  it("sends no example block for a template without variables", async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ id: "T2", status: "PENDING" }), { status: 200 }));
    globalThis.fetch = fake as unknown as typeof fetch;
    const { createWhatsAppTemplate } = await import("./whatsapp");
    await createWhatsAppTemplate({ wabaId: "W1", accessToken: "t", name: "promo", language: "es", category: "MARKETING", bodyText: "Hola, hay una promoción." });
    const body = JSON.parse(String((fake.mock.calls as unknown as [string, RequestInit][])[0][1].body));
    expect(body.components[0]).toEqual({ type: "BODY", text: "Hola, hay una promoción." });
  });
});
