import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/crypto", () => ({ decryptSecret: (v: string) => v }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppTextMessage: vi.fn(), sendWhatsAppTemplateMessage: vi.fn(), fetchWhatsAppTemplateStatus: vi.fn() }));
vi.mock("@/lib/whatsappAlerts", () => ({ reportWhatsAppSendFailure: vi.fn() }));
import { APPOINTMENT_TEMPLATE_PRESETS } from "./appointmentTemplatePresets";
import { APPOINTMENT_TEMPLATES } from "./appointmentMessaging";
import { checkExamples, checkTemplateVariables, variableCount } from "./templateVariables";
import { convertTags } from "./templateTags";
import { normalizeButtons } from "./templateButtons";

describe("the appointment template presets", () => {
  const byName = Object.fromEntries(APPOINTMENT_TEMPLATE_PRESETS.map((p) => [p.name, p]));

  it("are exactly the three templates the platform sends", () => {
    for (const spec of Object.values(APPOINTMENT_TEMPLATES)) {
      const preset = byName[spec.name];
      expect(preset, spec.name).toBeDefined();
      expect(preset.language).toBe(spec.language);
      expect(variableCount(convertTags(preset.body).body)).toBe(spec.paramCount);
    }
    expect(APPOINTMENT_TEMPLATE_PRESETS).toHaveLength(Object.keys(APPOINTMENT_TEMPLATES).length);
  });

  it("fill their variables in the order the platform sends them", () => {
    expect(convertTags(byName.confirmacion_cita.body).tags).toEqual(["nombre", "fecha", "hora"]);
    expect(convertTags(byName.recordatorio_cita.body).tags).toEqual(["nombre", "fecha", "hora"]);
    expect(convertTags(byName.link_agendamiento.body).tags).toEqual(["nombre", "enlace"]);
  });

  it.each(APPOINTMENT_TEMPLATE_PRESETS.map((p) => [p.name, p] as const))("%s follows Meta's rules for variables, examples and buttons", (_name, preset) => {
    const converted = convertTags(preset.body);
    expect(converted.unrecognized).toEqual([]);
    expect(checkTemplateVariables(converted.body)).toBeNull();
    expect(checkExamples(converted.body, converted.examples)).toBeNull();
    expect(converted.body.length).toBeLessThanOrEqual(1024);
    expect(preset.name).toMatch(/^[a-z0-9_]+$/);
    expect(normalizeButtons(preset.buttons).ok).toBe(true);
  });
});
