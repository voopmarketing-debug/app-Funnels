import { afterEach, describe, expect, it, vi } from "vitest";
import { envChecks, metaChecks, webhookUrl } from "./metaSetup";

const KEYS = ["META_APP_ID", "META_APP_SECRET", "META_WA_CONFIG_ID", "WHATSAPP_VERIFY_TOKEN", "TOKEN_ENCRYPTION_KEY", "APP_HOST"];

afterEach(() => {
  for (const k of KEYS) vi.stubEnv(k, "");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("envChecks", () => {
  it("flags every missing setting with what to do", () => {
    for (const k of KEYS) vi.stubEnv(k, "");
    const checks = envChecks();
    expect(checks.every((c) => c.status === "fail" && c.fix)).toBe(true);
  });

  it("passes the settings that are present", () => {
    vi.stubEnv("META_WA_CONFIG_ID", "123");
    const row = envChecks().find((c) => c.id === "META_WA_CONFIG_ID");
    expect(row?.status).toBe("ok");
    expect(row?.fix).toBeUndefined();
  });
});

describe("metaChecks", () => {
  it("does not call Meta without the app credentials", async () => {
    vi.stubEnv("META_APP_ID", "");
    vi.stubEnv("META_APP_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await metaChecks();
    expect(out[0].status).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a webhook that points somewhere else", async () => {
    vi.stubEnv("META_APP_ID", "1");
    vi.stubEnv("META_APP_SECRET", "s");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/subscriptions")
          ? new Response(JSON.stringify({ data: [{ object: "whatsapp_business_account", callback_url: "https://old.example/hook", fields: [{ name: "messages" }] }] }))
          : new Response(JSON.stringify({ name: "Funnels" })),
      ),
    );
    const out = await metaChecks();
    expect(out.find((c) => c.id === "meta-app")?.status).toBe("ok");
    expect(out.find((c) => c.id === "webhook")?.status).toBe("fail");
  });

  it("accepts a webhook with our URL and the messages field", async () => {
    vi.stubEnv("META_APP_ID", "1");
    vi.stubEnv("META_APP_SECRET", "s");
    const url = webhookUrl();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) =>
        String(u).includes("/subscriptions")
          ? new Response(JSON.stringify({ data: [{ object: "whatsapp_business_account", callback_url: url, fields: [{ name: "messages" }] }] }))
          : new Response(JSON.stringify({ name: "Funnels" })),
      ),
    );
    expect((await metaChecks()).find((c) => c.id === "webhook")?.status).toBe("ok");
  });
});
