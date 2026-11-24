import { describe, expect, it } from "vitest";
import { WebsiteContentV2Schema } from "@/lib/websiteContentV2";
import { renderWebsiteHtmlV2 } from "@/lib/websiteTemplateV2";
import { allowThankYouRedirect, thankYouTarget } from "@/lib/sitePublish";
import { eventDateOk, toIsoWithZone } from "@/lib/websiteBlocks";
import { FUNNELS, buildFunnelContent } from "./funnels";
import { listFunnelCards } from "./index";

const ctx = { businessName: "Estudio Vértice", trackingBasePath: "/sitio/x", preview: false, heroImageUrl: null, photos: [], products: [] };
const visible = (c: ReturnType<typeof buildFunnelContent>) => c.sections.filter((_, i) => !c.hidden.includes(i));
const texts = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(texts) : v && typeof v === "object" ? Object.values(v).flatMap(texts) : []);

describe("funnel templates", () => {
  it("has the funnels the library promises, each with its own structure", () => {
    expect(FUNNELS.map((f) => f.id)).toEqual(expect.arrayContaining(["embudo-vsl", "embudo-lead-magnet", "embudo-webinar", "embudo-llamada"]));
    const signatures = FUNNELS.map((f) => f.build("X").map((s) => `${s.type}:${"variant" in s ? String(s.variant) : ""}`).join(">"));
    expect(new Set(signatures).size).toBe(FUNNELS.length);
    expect(listFunnelCards()).toHaveLength(FUNNELS.length);
  });

  for (const funnel of FUNNELS) {
    describe(funnel.id, () => {
      const content = buildFunnelContent(funnel, { businessName: "Estudio Vértice" });

      it("is valid and starts with a hero", () => {
        expect(WebsiteContentV2Schema.safeParse(content).success).toBe(true);
        expect(content.sections[0].type).toBe("hero");
        expect(JSON.stringify(content)).not.toContain("{negocio}");
      });

      it("never invents facts: no numbers, prices, dates or superlatives in what the public sees", () => {
        const all = visible(content).flatMap((s) => texts(s));
        for (const t of all) {
          expect(t, t).not.toMatch(/\d/);
          expect(t, t).not.toMatch(/\$|%|garant[ií]a de|el mejor|n[úu]mero uno|100 ?%/i);
          expect(t, t).not.toMatch(/Escribe aquí|Nombre del cliente|Primera cosa/);
        }
      });

      it("keeps testimonials, offer and guarantee hidden until the owner writes the real thing", () => {
        content.sections.forEach((s, i) => {
          if (s.type === "testimonials" || s.type === "offer" || s.type === "guarantee") expect(content.hidden, `${s.type} at ${i}`).toContain(i);
        });
      });

      it("shows nothing broken to the public before the owner adds a video link or a date", () => {
        const html = renderWebsiteHtmlV2(content, ctx);
        expect(html).not.toContain(`class="vid-frame`);
        expect(html).not.toContain('id="fecha"');
        expect(html).not.toContain("Aquí irá tu video");
        expect(html).not.toContain("Escribe aquí");
      });
    });
  }

  it("a filled video and event show up, with a countdown to the date", () => {
    const content = buildFunnelContent(FUNNELS.find((f) => f.id === "embudo-webinar")!, { businessName: "X" });
    const ev = content.sections.find((s) => s.type === "event");
    if (ev?.type === "event") {
      ev.when = "Jueves, siete de la noche";
      ev.date = "2030-05-02T19:00";
    }
    const html = renderWebsiteHtmlV2(content, ctx);
    expect(html).toContain("Jueves, siete de la noche");
    expect(html).toContain('data-until="2030-05-02T19:00:00-05:00"');
  });

  it("the sticky button and the thank-you link behave", () => {
    const vsl = buildFunnelContent(FUNNELS[0], { businessName: "X" });
    expect(renderWebsiteHtmlV2(vsl, ctx)).toContain("sticky-cta");
    expect(thankYouTarget({ thankYouUrl: "https://gracias.example.com/ok" })).toBe("https://gracias.example.com/ok");
    for (const bad of ["javascript:alert(1)", "ftp://x.test", "//evil.test", "", null, 5]) expect(thankYouTarget({ thankYouUrl: bad })).toBeNull();
    const headers = allowThankYouRedirect({ "Content-Security-Policy": "default-src 'self'; form-action 'self'" }, { thankYouUrl: "https://gracias.example.com/ok" });
    expect(headers["Content-Security-Policy"]).toContain("form-action 'self' https://gracias.example.com");
    expect(allowThankYouRedirect({ "Content-Security-Policy": "form-action 'self'" }, {})["Content-Security-Policy"]).toBe("form-action 'self'");
  });

  it("event dates are checked and read as Colombian time", () => {
    expect(eventDateOk("2030-05-02T19:00")).toBe(true);
    expect(eventDateOk("2030-05-02T19:00:00-05:00")).toBe(true);
    for (const bad of ["mañana", "2030-13-45T99:00", "2030-05-02", "<script>"]) expect(eventDateOk(bad), bad).toBe(false);
    expect(toIsoWithZone("2030-05-02T19:00")).toBe("2030-05-02T19:00:00-05:00");
  });
});
