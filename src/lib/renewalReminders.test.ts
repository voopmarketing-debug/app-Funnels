import { describe, expect, it } from "vitest";
import { reminderEmail, reminderKindFor } from "./renewalReminders";

const DAY = 86_400_000;
const now = new Date("2026-11-12T15:00:00Z");
const endIn = (days: number) => new Date(now.getTime() + days * DAY);

describe("reminderKindFor", () => {
  it("is silent while the plan has more than 5 days left", () => {
    expect(reminderKindFor(endIn(5.5), now)).toBeNull();
    expect(reminderKindFor(endIn(30), now)).toBeNull();
  });

  it("sends the 5-day one from 5 days out until the last day", () => {
    expect(reminderKindFor(endIn(5), now)).toBe("d5");
    expect(reminderKindFor(endIn(2), now)).toBe("d5");
  });

  it("sends the last-day one inside the final 24 hours", () => {
    expect(reminderKindFor(endIn(1), now)).toBe("d1");
    expect(reminderKindFor(endIn(0.2), now)).toBe("d1");
  });

  it("sends the ended one just after the end, and still catches a missed run", () => {
    expect(reminderKindFor(endIn(-0.01), now)).toBe("d0");
    expect(reminderKindFor(endIn(-2.9), now)).toBe("d0");
  });

  it("stops bothering an account that ended long ago", () => {
    expect(reminderKindFor(endIn(-3.1), now)).toBeNull();
    expect(reminderKindFor(endIn(-60), now)).toBeNull();
  });
});

describe("reminderEmail", () => {
  const info = { name: "Dr. <Ruiz>", planLabel: "Pro", priceCop: 1_190_000, endsAt: new Date("2026-12-03T12:00:00Z"), host: "agente.funnelslabs.app" };

  it("links straight to the renewal screen with the price", () => {
    const { html } = reminderEmail("d5", info);
    expect(html).toContain("https://agente.funnelslabs.app/renovar");
    expect(html).toContain("$1.190.000 COP");
    expect(html).toContain("Plan Pro");
  });

  it("says when the plan ends, or that it already did", () => {
    expect(reminderEmail("d5", info).html).toContain("3 de diciembre");
    expect(reminderEmail("d1", info).subject).toMatch(/Mañana/);
    expect(reminderEmail("d0", info).subject).toMatch(/venció/);
  });

  it("does not let a name inject markup", () => {
    expect(reminderEmail("d5", info).html).not.toContain("<Ruiz>");
  });
});
