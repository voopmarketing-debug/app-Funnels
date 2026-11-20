import { describe, expect, it } from "vitest";
import { STORE_APP_HIDDEN_PATHS, storeAppFromValue } from "./storeApp";

describe("storeAppFromValue", () => {
  it("only accepts the two apps", () => {
    expect(storeAppFromValue("android")).toBe(true);
    expect(storeAppFromValue("ios")).toBe(true);
    expect(storeAppFromValue("web")).toBe(false);
    expect(storeAppFromValue("")).toBe(false);
    expect(storeAppFromValue(null)).toBe(false);
    expect(storeAppFromValue(undefined)).toBe(false);
  });

  it("hides the sales and sign-up pages, never the login or the dashboard", () => {
    for (const p of ["/", "/oferta", "/register", "/gracias"]) expect(STORE_APP_HIDDEN_PATHS.has(p)).toBe(true);
    for (const p of ["/login", "/dashboard", "/privacidad", "/terminos", "/eliminar-cuenta"]) expect(STORE_APP_HIDDEN_PATHS.has(p)).toBe(false);
  });
});
