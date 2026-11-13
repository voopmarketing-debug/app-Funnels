import { describe, expect, it } from "vitest";
import { fromPanelUrl, withPanelBackLink, wantsPanelBack } from "./panelBackLink";

describe("panelBackLink", () => {
  it("marks the dashboard's link, with or without an existing query", () => {
    expect(fromPanelUrl("https://x.app/sitio/mi-pagina")).toBe("https://x.app/sitio/mi-pagina?desde=panel");
    expect(fromPanelUrl("https://x.app/sitio/mi-pagina?a=1")).toBe("https://x.app/sitio/mi-pagina?a=1&desde=panel");
  });

  it("only asks for the way back when the mark is there", () => {
    expect(wantsPanelBack(new URLSearchParams("desde=panel"))).toBe(true);
    expect(wantsPanelBack(new URLSearchParams("desde=otra"))).toBe(false);
    expect(wantsPanelBack(new URLSearchParams(""))).toBe(false);
  });

  it("adds the pill before </body>, hidden unless installed as an app, with no script", () => {
    const out = withPanelBackLink("<html><body><h1>Hola</h1></body></html>", "/dashboard/businesses/b1/website");
    expect(out).toContain('href="/dashboard/businesses/b1/website"');
    expect(out).toContain("@media (display-mode:standalone)");
    expect(out).not.toContain("<script");
    expect(out.indexOf("fl-panel-back")).toBeLessThan(out.indexOf("</body>"));
  });

  it("still adds it to a fragment with no </body>", () => {
    expect(withPanelBackLink("<p>Hola</p>", "/dashboard")).toContain("Volver al panel");
  });
});
