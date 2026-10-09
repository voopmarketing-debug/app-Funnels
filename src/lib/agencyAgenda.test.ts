import { describe, expect, it } from "vitest";
import { answerLabel, colombiaSlot, isQualifiedLead } from "./agencyAgenda";
import { renderAgencyAgendaPage } from "./agencyAgendaPage";
import { createHash } from "node:crypto";

describe("isQualifiedLead", () => {
  it("sends only low-volume visitors who are just browsing to WhatsApp", () => {
    expect(isQualifiedLead({ negocio: "clinica", mensajes: "menos_50", inicio: "averiguando" })).toBe(false);
    expect(isQualifiedLead({ negocio: "clinica", mensajes: "menos_50", inicio: "este_mes" })).toBe(true);
    expect(isQualifiedLead({ negocio: "tienda", mensajes: "300_1000", inicio: "averiguando" })).toBe(true);
  });
});

describe("colombiaSlot", () => {
  it("reads the slot in Colombia time", () => {
    expect(colombiaSlot("2026-10-12", "10:00")?.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(colombiaSlot("12/10/2026", "10:00")).toBeNull();
  });
});

describe("answerLabel", () => {
  it("turns stored values into what the visitor read", () => {
    expect(answerLabel("mensajes", "300_1000")).toBe("300 a 1.000");
    expect(answerLabel("negocio", undefined)).toBe("—");
  });
});

describe("renderAgencyAgendaPage", () => {
  it("allows exactly its own inline script and the booking endpoints", () => {
    const { html, csp } = renderAgencyAgendaPage({ crmUrl: "https://agente.funnelslabs.app/api/agenda-llamada" });
    const script = html.match(/<script>([\s\S]*)<\/script>/)![1];
    const hash = createHash("sha256").update(script).digest("base64");
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
    expect(csp).toContain("connect-src https://script.google.com https://script.googleusercontent.com https://agente.funnelslabs.app");
    expect(script).not.toMatch(/<\/script/i);
  });
});
