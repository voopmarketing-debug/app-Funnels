import { describe, expect, it } from "vitest";
import { checkCustomDomain } from "./customDomain";

describe("checkCustomDomain", () => {
  it("accepts a subdomain and cleans the way it was typed", () => {
    expect(checkCustomDomain("  HTTPS://Pagina.TuNegocio.com/inicio?x=1 ")).toEqual({ ok: true, domain: "pagina.tunegocio.com" });
    expect(checkCustomDomain("pagina.tunegocio.com.")).toEqual({ ok: true, domain: "pagina.tunegocio.com" });
  });
  it("lets the field be cleared", () => {
    expect(checkCustomDomain("   ")).toEqual({ ok: true, domain: "" });
  });
  it("asks for a subdomain, not a bare domain", () => {
    expect(checkCustomDomain("tunegocio.com")).toMatchObject({ ok: false });
  });
  it("refuses the platform's own hosts and anything that is not a DNS name", () => {
    for (const bad of ["x.funnelslabs.app", "agente.funnelslabs.app", "a.b.vercel.app", "a.b.localhost", "1.2.3.4.5", "bad_name.tunegocio.com", "-a.tunegocio.com", "a..tunegocio.com", "a.tunegocio.c0m", "a b.tunegocio.com"]) {
      expect(checkCustomDomain(bad), bad).toMatchObject({ ok: false });
    }
  });
});
