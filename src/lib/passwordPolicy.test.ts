import { describe, expect, it } from "vitest";
import { passwordProblem } from "./passwordPolicy";

describe("passwordProblem", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem("Mi-negocio-2026")).toBeNull();
    expect(passwordProblem("una frase larga con espacios")).toBeNull();
  });
  it("asks for at least 10 characters", () => {
    expect(passwordProblem("corta123")).toMatch(/al menos 10/);
  });
  it("refuses what bcrypt would cut and the most obvious ones", () => {
    expect(passwordProblem("a1".repeat(40))).toMatch(/demasiado larga/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/fácil de adivinar/);
    expect(passwordProblem("Password123")).toMatch(/fácil de adivinar/);
    expect(passwordProblem("1234567890")).toMatch(/fácil de adivinar/);
  });
});
