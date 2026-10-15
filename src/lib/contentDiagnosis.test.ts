import { describe, expect, it } from "vitest";
import { alignProducts, type ContentDiagnosis } from "./contentDiagnosis";

const idea = (producto: string) => ({ producto, titulo: "t", red: "Instagram" as const, formato: "Reel" as const, gancho: "g", desarrollo: "d", texto: "x", porque: "p" });
const base = (over: Partial<ContentDiagnosis>): ContentDiagnosis => ({
  resumen: "r", puntuacion: 6, funciona: ["a"], noFunciona: ["b"], recomendaciones: ["c"], cuandoPublicar: "lunes", ideas: [], anuncios: null, productos: null, ...over,
});
const prod = (nombre: string) => ({ nombre, publicaciones: 2, estado: "Poco contenido" as const, resumen: "r", proximo: "Publica" });

describe("alignProducts", () => {
  const names = ["App Bodytech", "My Coach", "Personal Trainer Online"];

  it("matches the names to the catalog even when the case or accents differ", () => {
    const out = alignProducts(base({ ideas: [idea("my coach"), idea("PERSONAL TRAINER ONLINE")], productos: [prod("app bodytech"), prod("My Coach"), prod("Personal Trainer Online")] }), names);
    expect(out.ideas.map((i) => i.producto)).toEqual(["My Coach", "Personal Trainer Online"]);
    expect(out.productos?.map((p) => p.nombre)).toEqual(names);
  });

  it("calls an idea General when it is for none of them", () => {
    expect(alignProducts(base({ ideas: [idea("Otra cosa"), idea("")] }), names).ideas.map((i) => i.producto)).toEqual(["General", "General"]);
  });

  it("without a list to split, everything is General and there is no product summary", () => {
    const out = alignProducts(base({ ideas: [idea("My Coach")], productos: [prod("My Coach")] }), []);
    expect(out.ideas[0].producto).toBe("General");
    expect(out.productos).toBeNull();
  });

  it("works on ideas of the ads report too", () => {
    const ads = { resumen: "r", puntuacion: 5, mejoras: [], presupuesto: "p", ideas: [{ producto: "my coach", titulo: "t", formato: "Video" as const, gancho: "g", texto: "x", publico: "p", porque: "q" }] };
    expect(alignProducts(base({ anuncios: ads }), names).anuncios?.ideas[0].producto).toBe("My Coach");
  });
});
