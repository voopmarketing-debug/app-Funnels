import { describe, expect, it } from "vitest";
import { canEditFlows } from "./flowAccess";

describe("canEditFlows", () => {
  it("lets the owner and the agency always, whatever the switch says", () => {
    expect(canEditFlows("OWNER", true)).toBe(true);
    expect(canEditFlows("OWNER", false)).toBe(true);
    expect(canEditFlows("ADMIN", true)).toBe(true);
    expect(canEditFlows("ADMIN", false)).toBe(true);
  });

  it("lets a salesperson only while the owner leaves it on", () => {
    expect(canEditFlows("MEMBER", true)).toBe(true);
    expect(canEditFlows("MEMBER", false)).toBe(false);
  });
});
