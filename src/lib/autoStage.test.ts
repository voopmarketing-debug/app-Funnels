import { describe, expect, it } from "vitest";
import { bookedStageAfter, resolveAutoStageMove } from "./autoStage";

const stages = ["Nuevo", "En conversación", "Interesado", "Ganado", "Perdido"].map((name, position) => ({ id: `s${position}`, name, position }));
const withBooked = ["Nuevo", "En conversación", "Interesado", "Agendado", "Ganado", "Perdido"].map((name, position) => ({ id: `b${position}`, name, position }));

describe("resolveAutoStageMove", () => {
  it("moves a lead forward", () => {
    expect(resolveAutoStageMove(stages, "s1", "Interesado")?.id).toBe("s2");
    expect(resolveAutoStageMove(stages, "s0", "ganado")?.id).toBe("s3");
  });

  it("never moves a lead backwards or to where it already is", () => {
    expect(resolveAutoStageMove(stages, "s2", "En conversación")).toBeNull();
    expect(resolveAutoStageMove(stages, "s2", "Interesado")).toBeNull();
  });

  it("never takes a lead out of a won stage", () => {
    expect(resolveAutoStageMove(stages, "s3", "Perdido")).toBeNull();
  });

  it("can mark a lead lost from any open stage, and bring a lost lead back", () => {
    expect(resolveAutoStageMove(stages, "s1", "Perdido")?.id).toBe("s4");
    expect(resolveAutoStageMove(stages, "s4", "Interesado")?.id).toBe("s2");
  });

  it("ignores unknown stages and leads outside the funnel", () => {
    expect(resolveAutoStageMove(stages, "s1", "VIP")).toBeNull();
    expect(resolveAutoStageMove(stages, "other", "Ganado")).toBeNull();
  });
});

describe("bookedStageAfter", () => {
  it("finds the funnel's booked stage ahead of the lead", () => {
    expect(bookedStageAfter(withBooked, "b2")?.name).toBe("Agendado");
  });

  it("is null when the funnel has no booked stage, or the lead is past it", () => {
    expect(bookedStageAfter(stages, "s1")).toBeNull();
    expect(bookedStageAfter(withBooked, "b4")).toBeNull();
  });
});
