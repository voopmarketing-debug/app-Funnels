import { describe, expect, it } from "vitest";
import { maskEmail } from "./logPrivacy";

describe("maskEmail", () => {
  it("keeps the first two letters and the domain", () => {
    expect(maskEmail("Juan.Perez@Gmail.com")).toBe("ju***@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });

  it("hides anything that isn't an email", () => {
    expect(maskEmail("sin-arroba")).toBe("***");
    expect(maskEmail("")).toBe("");
    expect(maskEmail(null)).toBe("");
  });
});
