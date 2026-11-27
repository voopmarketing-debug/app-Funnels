import { describe, expect, it } from "vitest";
import { freeStarts, overlapsAny } from "./agendaSlots";
import { durationLabel, parseServices } from "./agendaServices";
import { renderAgendaHtml, safeHttpUrl } from "./agendaTemplate";
import { AGENDA_STYLES } from "./agendaStyles";

const base = {
  businessName: "Clínica Sol",
  primaryColor: "#1f6feb",
  trackingBasePath: "/sitio/x",
  professionals: [],
  professionalId: null,
  upcomingDates: ["2030-01-07"],
  dateStr: null,
  availableSlots: [],
  timeStr: null,
  confirmed: null,
  bookingError: null,
};

describe("freeStarts", () => {
  it("offers every grid time that fits", () => {
    expect(freeStarts({ startMin: 540, endMin: 600, gridMinutes: 30, duration: 30, busy: [] })).toEqual([540, 570]);
  });
  it("a 60-minute service needs the whole hour free and inside the hours", () => {
    const out = freeStarts({ startMin: 540, endMin: 660, gridMinutes: 30, duration: 60, busy: [] });
    expect(out).toEqual([540, 570, 600]);
  });
  it("blocks every start that would overlap a longer booking", () => {
    // 09:30-10:30 is taken: a 60-minute service cannot start at 09:00, 09:30 or 10:00.
    const out = freeStarts({ startMin: 540, endMin: 720, gridMinutes: 30, duration: 60, busy: [{ start: 570, end: 630 }] });
    expect(out).toEqual([630, 660]);
  });
  it("a short service still fits right after a booking ends", () => {
    const out = freeStarts({ startMin: 540, endMin: 660, gridMinutes: 30, duration: 30, busy: [{ start: 540, end: 600 }] });
    expect(out).toEqual([600, 630]);
  });
  it("hides times already past", () => {
    expect(freeStarts({ startMin: 540, endMin: 660, gridMinutes: 30, duration: 30, busy: [], notBefore: 570 })).toEqual([600, 630]);
  });
  it("overlapsAny treats touching ranges as free", () => {
    expect(overlapsAny([{ start: 0, end: 30 }], 30, 60)).toBe(false);
    expect(overlapsAny([{ start: 0, end: 31 }], 30, 60)).toBe(true);
  });
});

describe("parseServices", () => {
  it("drops invalid rows and duplicates", () => {
    const out = parseServices([{ id: "a", name: "Limpieza", minutes: 45 }, { id: "a", name: "Otra", minutes: 30 }, { id: "b", name: "", minutes: 30 }, { id: "c", name: "X", minutes: 2 }, "nope"]);
    expect(out.map((s) => s.id)).toEqual(["a"]);
  });
  it("keeps price and description when given", () => {
    expect(parseServices([{ id: "a", name: "Consulta", minutes: 30, price: "$80.000", description: "Primera vez" }])[0]).toMatchObject({ price: "$80.000", description: "Primera vez" });
  });
  it("labels durations", () => {
    expect([durationLabel(45), durationLabel(60), durationLabel(90)]).toEqual(["45 min", "1 h", "1 h 30 min"]);
  });
});

describe("renderAgendaHtml", () => {
  it("draws every style", () => {
    for (const style of AGENDA_STYLES) {
      const html = renderAgendaHtml({ ...base, style });
      expect(html).toContain(`data-style="${style}"`);
      expect(html).toContain("Clínica Sol");
    }
  });
  it("asks for the service first when there are services, then the professional", () => {
    const services = [{ id: "s1", name: "Limpieza", minutes: 45, price: "$90.000" }];
    const first = renderAgendaHtml({ ...base, services, professionals: [{ id: "p1", name: "Dra. Gómez", title: null }] });
    expect(first).toContain("¿Qué necesitas?");
    expect(first).toContain("$90.000");
    const second = renderAgendaHtml({ ...base, services, serviceId: "s1", professionals: [{ id: "p1", name: "Dra. Gómez", title: "Ortodoncista" }] });
    expect(second).toContain("¿Con quién?");
    expect(second).toContain("service=s1");
    expect(second).toContain("Ortodoncista");
  });
  it("carries the service and the note field into the form", () => {
    const html = renderAgendaHtml({ ...base, services: [{ id: "s1", name: "Limpieza", minutes: 45 }], serviceId: "s1", dateStr: "2030-01-07", timeStr: "09:00", askNote: true });
    expect(html).toContain('name="service" value="s1"');
    expect(html).toContain('name="note"');
    expect(renderAgendaHtml({ ...base, dateStr: "2030-01-07", timeStr: "09:00", askNote: false })).not.toContain('name="note"');
  });
  it("escapes what the owner types and only links http(s)", () => {
    const html = renderAgendaHtml({ ...base, title: "<script>alert(1)</script>", address: "Cra <b>1</b>", mapUrl: "javascript:alert(1)", logoUrl: "javascript:alert(1)" });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("javascript:");
    expect(safeHttpUrl("https://maps.google.com/?q=1")).toBe("https://maps.google.com/?q=1");
    expect(safeHttpUrl("ftp://x")).toBeNull();
  });
});
