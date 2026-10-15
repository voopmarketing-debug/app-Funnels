import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeSignupCode, parseSignupMessage, registerPhoneNumber } from "./whatsappSignup";

describe("parseSignupMessage", () => {
  it("reads the IDs of a finished signup", () => {
    const raw = JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "P1", waba_id: "W1", business_id: "B1" } });
    expect(parseSignupMessage(raw)).toEqual({ event: "FINISH", phoneNumberId: "P1", wabaId: "W1" });
  });
  it("reports a cancel and ignores unrelated messages", () => {
    expect(parseSignupMessage({ type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: {} })).toEqual({ event: "CANCEL" });
    expect(parseSignupMessage("not json")).toBeNull();
    expect(parseSignupMessage(JSON.stringify({ type: "other" }))).toBeNull();
    expect(parseSignupMessage(JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: {} }))).toBeNull();
  });
});

describe("exchangeSignupCode / registerPhoneNumber", () => {
  const realFetch = globalThis.fetch;
  const env = { id: process.env.META_APP_ID, secret: process.env.META_APP_SECRET };
  beforeEach(() => {
    process.env.META_APP_ID = "app1";
    process.env.META_APP_SECRET = "sec1";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.META_APP_ID = env.id;
    process.env.META_APP_SECRET = env.secret;
  });
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("trades the code for a token", async () => {
    const fake = reply({ access_token: "TOK" });
    globalThis.fetch = fake as unknown as typeof fetch;
    expect(await exchangeSignupCode("CODE")).toEqual({ ok: true, accessToken: "TOK" });
    const url = String((fake.mock.calls as unknown as unknown[][])[0][0]);
    expect(url).toContain("code=CODE");
    expect(url).toContain("client_id=app1");
  });
  it("explains a refused code", async () => {
    globalThis.fetch = reply({ error: { message: "This authorization code has been used" } }, 400) as unknown as typeof fetch;
    const res = await exchangeSignupCode("CODE");
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("has been used") });
  });
  it("registers a number and tolerates a refusal", async () => {
    globalThis.fetch = reply({ success: true }) as unknown as typeof fetch;
    expect(await registerPhoneNumber({ phoneNumberId: "P1", accessToken: "t" })).toEqual({ ok: true });
    globalThis.fetch = reply({ error: { message: "already registered" } }, 400) as unknown as typeof fetch;
    expect(await registerPhoneNumber({ phoneNumberId: "P1", accessToken: "t" })).toEqual({ ok: false, error: "already registered" });
  });
});
