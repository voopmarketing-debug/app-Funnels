import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeSignupCode, isValidPin, ownPageUrl, parseSignupMessage, registerPhoneNumber } from "./whatsappSignup";

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
  it("retries with another redirect_uri when Meta refuses the first", async () => {
    const mismatch = "Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request";
    const fake = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: mismatch } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "TOK" }), { status: 200 }));
    globalThis.fetch = fake as unknown as typeof fetch;
    expect(await exchangeSignupCode("CODE")).toEqual({ ok: true, accessToken: "TOK" });
    const calls = fake.mock.calls as unknown as unknown[][];
    expect(String(calls[0][0])).not.toContain("redirect_uri");
    expect(String(calls[1][0])).toContain("redirect_uri=");
  });
  it("keeps trying past a 'Can't load URL' refusal until one value is accepted", async () => {
    const cantLoad = "Can't load URL: The domain of this URL isn't included in the app's domains.";
    const fake = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Error validating verification code. Please make sure your redirect_uri is identical" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: cantLoad } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "TOK" }), { status: 200 }));
    globalThis.fetch = fake as unknown as typeof fetch;
    const res = await exchangeSignupCode("CODE", "https://agente.funnelslabs.app/dashboard/businesses/b1");
    expect(res).toEqual({ ok: true, accessToken: "TOK" });
    const calls = fake.mock.calls as unknown as unknown[][];
    expect(decodeURIComponent(String(calls[2][0]))).toContain("redirect_uri=https://agente.funnelslabs.app/dashboard/businesses/b1");
  });
  it("only accepts a page address from this platform", () => {
    expect(ownPageUrl("https://agente.funnelslabs.app/dashboard/businesses/b1#x")).toBe("https://agente.funnelslabs.app/dashboard/businesses/b1");
    expect(ownPageUrl("https://evil.example/dashboard")).toBeUndefined();
    expect(ownPageUrl("http://agente.funnelslabs.app/")).toBeUndefined();
    expect(ownPageUrl("not a url")).toBeUndefined();
    expect(ownPageUrl(undefined)).toBeUndefined();
  });
  it("does not retry for other refusals", async () => {
    const fake = reply({ error: { message: "This authorization code has expired" } }, 400);
    globalThis.fetch = fake as unknown as typeof fetch;
    expect(await exchangeSignupCode("CODE")).toMatchObject({ ok: false });
    expect(fake).toHaveBeenCalledTimes(1);
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
    expect(await registerPhoneNumber({ phoneNumberId: "P1", accessToken: "t" })).toEqual({ ok: false, error: "already registered", needsPin: false });
  });
  it("asks for the PIN when the number comes with two-step verification", async () => {
    globalThis.fetch = reply({ error: { message: "Two step verification PIN Mismatch", code: 133005 } }, 400) as unknown as typeof fetch;
    expect(await registerPhoneNumber({ phoneNumberId: "P1", accessToken: "t" })).toMatchObject({ ok: false, needsPin: true });
  });
  it("sends the PIN the person typed", async () => {
    const fake = reply({ success: true });
    globalThis.fetch = fake as unknown as typeof fetch;
    expect(await registerPhoneNumber({ phoneNumberId: "P1", accessToken: "t", pin: "123456" })).toEqual({ ok: true });
    const init = (fake.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect(JSON.parse(String(init.body)).pin).toBe("123456");
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12345a")).toBe(false);
  });
});
