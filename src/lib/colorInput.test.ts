import { describe, expect, it } from "vitest";
import { parseColorInput } from "./colorInput";

describe("parseColorInput", () => {
  it("accepts hex with or without #, and short hex", () => {
    expect(parseColorInput("#F3F3EF")).toBe("#f3f3ef");
    expect(parseColorInput("f3f3ef")).toBe("#f3f3ef");
    expect(parseColorInput(" #fff ")).toBe("#ffffff");
  });
  it("accepts rgb() and bare numbers", () => {
    expect(parseColorInput("rgb(243, 243, 239)")).toBe("#f3f3ef");
    expect(parseColorInput("rgba(0,0,0,0.5)")).toBe("#000000");
    expect(parseColorInput("243, 243, 239")).toBe("#f3f3ef");
  });
  it("rejects anything else", () => {
    expect(parseColorInput("rgb(300,0,0)")).toBeNull();
    expect(parseColorInput("rojo")).toBeNull();
    expect(parseColorInput("#12345")).toBeNull();
  });
});
