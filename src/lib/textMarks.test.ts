import { describe, expect, it } from "vitest";
import { joinMarks, parseMarks, renderMarks, stripMarks } from "./textMarks";

const marked = "Agenda ⁣#e11d48⁤una llamada⁣ hoy";

describe("colores en parte de un texto", () => {
  it("quita las marcas para leer el texto", () => {
    expect(stripMarks(marked)).toBe("Agenda una llamada hoy");
    expect(stripMarks("a⁣#zzzzzz⁤b")).toBe("a#zzzzzzb");
  });

  it("las separa y las junta sin perder nada", () => {
    const parts = parseMarks(marked);
    expect(parts).toEqual([
      { text: "Agenda ", color: null },
      { text: "una llamada", color: "#e11d48" },
      { text: " hoy", color: null },
    ]);
    expect(joinMarks(parts)).toBe(marked);
    // Neighbors of the same color become one.
    expect(joinMarks([{ text: "a", color: "#111111" }, { text: "b", color: "#111111" }])).toBe("⁣#111111⁤ab⁣");
  });

  it("la página pública dibuja un span con el color; en atributos y en el título solo se quitan", () => {
    const html = `<html><head><title>Hola ${marked}</title></head><body><h1 title="${marked}">${marked}</h1></body></html>`;
    const out = renderMarks(html);
    expect(out).toContain('<h1 title="Agenda una llamada hoy">Agenda <span style="color:#e11d48">una llamada</span> hoy</h1>');
    expect(out).toContain("<title>Hola Agenda una llamada hoy</title>");
    expect(out).not.toMatch(/[⁣⁤]/);
  });

  it("una marca rota no deja rastro ni cuela un color inválido", () => {
    expect(renderMarks("<p>a⁣#e11d48⁤b</p>")).toBe("<p>a#e11d48b</p>");
    expect(renderMarks('<p>⁣red;}</style>⁤x⁣</p>')).not.toContain("<span");
  });
});
