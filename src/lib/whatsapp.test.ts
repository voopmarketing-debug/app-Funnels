import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { parseInboundMessages, verifyWebhookSignature } from "./whatsapp";

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
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parseInboundMessages(payload).map((m) => m.text)).toEqual([
      "Sí, me interesa",
      "Plan anual",
      "[Ubicación compartida: Oficina] https://maps.google.com/?q=4.6,-74.08",
      "[Contacto compartido: Ana +57 300 111 2233]",
      "[Sticker]",
    ]);
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
