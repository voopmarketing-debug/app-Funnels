import { describe, expect, it } from "vitest";
import { isWonStageName } from "./sales";

describe("isWonStageName", () => {
  it("recognizes the usual 'won' stage names", () => {
    for (const name of ["Ganado", "Ganada", "Vendido", "Cerrado", "Venta cerrada", "Pagado", "Compró"]) {
      expect(isWonStageName(name)).toBe(true);
    }
  });

  it("ignores stages that only mention a sale or a client", () => {
    for (const name of ["Nuevo", "En conversación", "Interesado", "Cliente potencial", "En venta", "Comprometido", "Perdido", "Cerrado perdido"]) {
      expect(isWonStageName(name)).toBe(false);
    }
  });
});
