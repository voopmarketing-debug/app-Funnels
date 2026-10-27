import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./safeRedirect";

describe("safeCallbackPath", () => {
  it("keeps paths of this site", () => {
    expect(safeCallbackPath("/dashboard/businesses/abc")).toBe("/dashboard/businesses/abc");
    expect(safeCallbackPath("/activar?estado=listo&x=1")).toBe("/activar?estado=listo&x=1");
  });
  it("falls back for anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null, undefined, "/%0d%0a/evil.com/\\"]) {
      expect(safeCallbackPath(bad as string | null | undefined)).toBe("/dashboard");
    }
  });
  it("uses the given fallback", () => {
    expect(safeCallbackPath("//x", "/")).toBe("/");
  });
});
