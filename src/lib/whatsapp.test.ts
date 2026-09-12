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

  it("returns an empty array for malformed payloads", () => {
    expect(parseInboundMessages(null)).toEqual([]);
    expect(parseInboundMessages({})).toEqual([]);
  });
});
