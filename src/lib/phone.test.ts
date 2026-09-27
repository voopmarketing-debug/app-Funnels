import { describe, expect, it } from "vitest";
import { isValidEmail, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("keeps a full international number as bare digits", () => {
    expect(normalizePhone("+57 300 123 4567")).toBe("573001234567");
    expect(normalizePhone("573001234567")).toBe("573001234567");
    expect(normalizePhone("0057 300-123-4567")).toBe("573001234567");
  });

  it("adds the default country code to a national number", () => {
    expect(normalizePhone("300 123 4567")).toBe("573001234567");
    expect(normalizePhone("(300) 123-4567", "52")).toBe("523001234567");
  });

  it("rejects values that can't be a phone", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("+1234")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses and rejects junk", () => {
    expect(isValidEmail("ana@empresa.co")).toBe(true);
    expect(isValidEmail("ana@empresa")).toBe(false);
    expect(isValidEmail("ana empresa.co")).toBe(false);
  });
});
