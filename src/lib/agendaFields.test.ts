import { describe, expect, it } from "vitest";
import { DEFAULT_FIELDS, collectSubmission, effectiveFields, inputName, parseAnswers, parseFields } from "./agendaFields";
import { renderAgendaHtml } from "./agendaTemplate";

const read = (data: Record<string, string>) => (n: string) => data[n] ?? "";

describe("parseFields", () => {
  it("always keeps name and contact, required, even if the owner removed or relaxed them", () => {
    const out = parseFields([{ id: "e", key: "email", type: "email", label: "Correo", required: false }]);
    expect(out.map((f) => f.key)).toEqual(["name", "contact", "email"]);
    const relaxed = parseFields([{ id: "name", key: "name", type: "text", label: "Nombre", required: false }]);
    expect(relaxed.find((f) => f.key === "name")?.required).toBe(true);
  });
  it("drops invalid rows, duplicate ids and selects without options", () => {
    const out = parseFields([
      { id: "a", type: "text", label: "Ciudad", required: false },
      { id: "a", type: "text", label: "Otra", required: false },
      { id: "b", type: "select", label: "Lista", required: false, options: [] },
      { id: "c", type: "bad", label: "X", required: false },
      { id: "d", type: "select", label: "Cómo nos conociste", required: true, options: ["Instagram", "Instagram", "Amigo"] },
    ]);
    expect(out.map((f) => f.id)).toEqual(["name", "contact", "a", "d"]);
    expect(out.find((f) => f.id === "d")?.options).toEqual(["Instagram", "Amigo"]);
  });
  it("uses the default four when never edited, honoring the old reason switch", () => {
    expect(effectiveFields([]).map((f) => f.key)).toEqual(["name", "contact", "email", "note"]);
    expect(effectiveFields([], false).map((f) => f.key)).toEqual(["name", "contact", "email"]);
  });
});

describe("collectSubmission", () => {
  const fields = parseFields([
    ...DEFAULT_FIELDS,
    { id: "src", type: "select", label: "Cómo nos conociste", required: true, options: ["Instagram", "Amigo"] },
    { id: "ok", type: "checkbox", label: "Acepto el tratamiento de datos", required: true },
    { id: "age", type: "number", label: "Edad", required: false },
  ]);
  const good = { name: "Ana", contact: "300", src: "", f_src: "Instagram", f_ok: "Sí", f_age: "34" };
  it("reads standard fields into their own columns and the rest as answers", () => {
    const r = collectSubmission(fields, read(good));
    expect(r).toMatchObject({ ok: true, name: "Ana", contact: "300" });
    if (r.ok) expect(r.answers).toEqual([{ label: "Cómo nos conociste", value: "Instagram" }, { label: "Acepto el tratamiento de datos", value: "Sí" }, { label: "Edad", value: "34" }]);
  });
  it("asks for what is missing, by the owner's own label", () => {
    expect(collectSubmission(fields, read({ ...good, name: "" }))).toEqual({ ok: false, error: "Falta completar: Tu nombre." });
    expect(collectSubmission(fields, read({ ...good, f_ok: "" }))).toMatchObject({ ok: false, error: expect.stringContaining("Acepto") });
  });
  it("rejects values that do not fit the field", () => {
    expect(collectSubmission(fields, read({ ...good, email: "no-es-correo" })).ok).toBe(false);
    expect(collectSubmission(fields, read({ ...good, f_src: "Otro" })).ok).toBe(false);
    expect(collectSubmission(fields, read({ ...good, f_age: "abc" })).ok).toBe(false);
  });
  it("ignores fields the owner never offered", () => {
    const only = parseFields([]);
    const r = collectSubmission(only, read({ name: "Ana", contact: "300", note: "hola", f_x: "y" }));
    if (r.ok) expect(r.note).toBe("");
  });
});

describe("the public form", () => {
  const base = { businessName: "X", primaryColor: "#1f6feb", trackingBasePath: "/s", professionals: [], professionalId: null, monthStr: "2030-01", todayStr: "2030-01-02", availableDates: [], prevMonth: null, nextMonth: null, dateStr: "2030-01-07", availableSlots: [], timeStr: "09:00", confirmed: null, bookingError: null };
  it("draws the owner's fields, with their own names and types", () => {
    const fields = parseFields([
      { id: "name", key: "name", type: "text", label: "Nombre completo", required: true },
      { id: "src", type: "select", label: "¿Cómo nos conociste?", required: true, options: ["Instagram", "Amigo"] },
      { id: "ok", type: "checkbox", label: "Acepto", required: true },
    ]);
    const html = renderAgendaHtml({ ...base, fields });
    expect(html).toContain("Nombre completo");
    expect(html).toContain('name="f_src"');
    expect(html).toContain('<option value="Amigo">');
    expect(html).toContain('type="checkbox" name="f_ok"');
    expect(inputName(fields[2])).toBe("f_src");
  });
  it("escapes what the owner types", () => {
    const fields = parseFields([{ id: "x", type: "text", label: '<img src=x onerror=alert(1)>', required: false }]);
    expect(renderAgendaHtml({ ...base, fields })).not.toContain("<img src=x onerror");
  });
});

describe("parseAnswers", () => {
  it("keeps only label/value pairs", () => {
    expect(parseAnswers([{ label: "a", value: "b" }, { label: 1 }, "x"])).toEqual([{ label: "a", value: "b" }]);
    expect(parseAnswers(null)).toEqual([]);
  });
});
