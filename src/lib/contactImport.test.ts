import { describe, expect, it } from "vitest";
import { parseCsv, rowsFromCsv } from "./contactImport";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes and newlines inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });

  it("detects the semicolon separator from Spanish-locale Excel", () => {
    expect(parseCsv("telefono;nombre\r\n3001234567;Ana\r\n")).toEqual([
      ["telefono", "nombre"],
      ["3001234567", "Ana"],
    ]);
  });
});

describe("rowsFromCsv", () => {
  it("maps columns by header in any order, with accents and a BOM", () => {
    const { rows, error } = rowsFromCsv("﻿Nombre;Teléfono;Correo\nAna;+57 300 123 4567;ana@x.co\n");
    expect(error).toBeNull();
    expect(rows).toEqual([{ phone: "+57 300 123 4567", name: "Ana", email: "ana@x.co", tags: undefined, notes: undefined }]);
  });

  it("explains a missing phone column", () => {
    expect(rowsFromCsv("nombre,correo\nAna,a@x.co").error).toMatch(/teléfono/);
  });

  it("skips blank lines", () => {
    expect(rowsFromCsv("telefono\n\n3001234567\n\n").rows).toHaveLength(1);
  });
});
