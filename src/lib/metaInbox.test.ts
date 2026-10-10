import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaApiError } from "./metaSocial";
import { isMissingPermission, listThreads, sendReply, threadMessages } from "./metaInbox";

function mockFetch(handler: (url: URL, init?: RequestInit) => { status?: number; body: unknown }) {
  const fn = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const { status = 200, body } = handler(new URL(String(input)), init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("listThreads", () => {
  it("finds the customer and whether the thread is waiting on us", async () => {
    mockFetch((url) => {
      expect(url.pathname).toContain("/page1/conversations");
      expect(url.searchParams.get("platform")).toBe("instagram");
      return {
        body: {
          data: [
            {
              id: "t1",
              updated_time: "2026-10-09T15:00:00+0000",
              snippet: "¿Tienen cupo mañana?",
              participants: { data: [{ id: "ig1", username: "clinica" }, { id: "u9", username: "ana.perez" }] },
              messages: {
                data: [
                  { message: "¿Tienen cupo mañana?", from: { id: "u9" }, created_time: "2026-10-09T15:00:00+0000" },
                  { message: "Hola Ana", from: { id: "ig1" }, created_time: "2026-10-09T14:00:00+0000" },
                ],
              },
            },
            {
              id: "t2",
              updated_time: "2026-10-08T10:00:00+0000",
              participants: { data: [{ id: "u7", username: "pedro" }, { id: "ig1", username: "clinica" }] },
              messages: {
                data: [
                  { message: "Con gusto", from: { id: "ig1" }, created_time: "2026-10-08T10:00:00+0000" },
                  { message: "Gracias", from: { id: "u7" }, created_time: "2026-10-08T09:00:00+0000" },
                ],
              },
            },
          ],
        },
      };
    });
    const threads = await listThreads({ pageId: "page1", igUserId: "ig1", pageToken: "tok", network: "instagram" });
    expect(threads[0]).toMatchObject({ id: "t1", customerId: "u9", customerName: "@ana.perez", lastFromCustomer: true, lastCustomerAt: "2026-10-09T15:00:00+0000" });
    expect(threads[1]).toMatchObject({ customerId: "u7", lastFromCustomer: false, snippet: "Con gusto", lastCustomerAt: "2026-10-08T09:00:00+0000" });
  });
});

describe("threadMessages", () => {
  it("returns oldest first with attachments and story replies", async () => {
    mockFetch(() => ({
      body: {
        messages: {
          data: [
            { id: "m2", message: "Gracias", from: { id: "page1" }, created_time: "2026-10-09T15:05:00+0000" },
            {
              id: "m1",
              message: "",
              from: { id: "u9" },
              created_time: "2026-10-09T15:00:00+0000",
              attachments: { data: [{ image_data: { url: "https://img/x.jpg" } }] },
              story: { reply_to: { link: "https://story" } },
            },
          ],
        },
      },
    }));
    const msgs = await threadMessages({ conversationId: "t1", pageId: "page1", igUserId: null, pageToken: "tok" });
    expect(msgs.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(msgs[0]).toMatchObject({ fromCustomer: true, storyNote: "Respondió a tu historia", attachments: [{ kind: "image", url: "https://img/x.jpg" }] });
    expect(msgs[1].fromCustomer).toBe(false);
  });
});

describe("sendReply", () => {
  it("posts a RESPONSE message to the customer", async () => {
    const fn = mockFetch(() => ({ body: { recipient_id: "u9", message_id: "mid" } }));
    await sendReply({ pageId: "page1", pageToken: "tok", recipientId: "u9", text: "Hola" });
    const [url, init] = fn.mock.calls[0];
    expect(String(url)).toContain("/page1/messages");
    expect(JSON.parse(String(init?.body))).toEqual({ recipient: { id: "u9" }, messaging_type: "RESPONSE", message: { text: "Hola" } });
  });

  it("explains the 24-hour window in plain words", async () => {
    mockFetch(() => ({ status: 400, body: { error: { message: "(#10) This message is sent outside of allowed window.", code: 10, error_subcode: 2018278 } } }));
    await expect(sendReply({ pageId: "p", pageToken: "t", recipientId: "u", text: "x" })).rejects.toThrow(/24 horas/);
  });
});

describe("isMissingPermission", () => {
  it("recognises Meta's permission errors", () => {
    expect(isMissingPermission(new MetaApiError("(#200) Requires pages_messaging permission", 200))).toBe(true);
    expect(isMissingPermission(new MetaApiError("Invalid OAuth access token", 190))).toBe(false);
  });
});
