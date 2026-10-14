import { describe, expect, it } from "vitest";
import { ASSISTANT_TOOLS, READ_TOOL_LABELS, ToolInputError, buildProposal, isProposeTool, runReadTool } from "./tools";

const mine = [{ id: "biz1", name: "Clínica Sonrisa", role: "OWNER" }];

describe("tool definitions", () => {
  it("sends plain JSON Schema objects with unique names", () => {
    const names = ASSISTANT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of ASSISTANT_TOOLS) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema).not.toHaveProperty("$schema");
      expect(t.description?.length).toBeGreaterThan(20);
    }
  });

  it("labels every read tool and tells proposals apart", () => {
    for (const t of ASSISTANT_TOOLS) {
      if (isProposeTool(t.name)) expect(t.name.startsWith("propose_")).toBe(true);
      else expect(READ_TOOL_LABELS[t.name]).toBeTruthy();
    }
  });
});

describe("scope", () => {
  it("never reads a business the person can't open", async () => {
    await expect(runReadTool("get_business", { businessId: "someone-else" }, mine)).rejects.toBeInstanceOf(ToolInputError);
    await expect(runReadTool("read_conversations", { businessId: "someone-else" }, mine)).rejects.toThrow(/No tienes acceso/);
  });

  it("lists only the person's own businesses", async () => {
    expect(await runReadTool("list_my_businesses", {}, mine)).toEqual([{ id: "biz1", name: "Clínica Sonrisa", role: "OWNER" }]);
  });

  it("rejects unknown tools and malformed input before touching data", async () => {
    await expect(runReadTool("drop_database", {}, mine)).rejects.toThrow(/desconocida/);
    await expect(runReadTool("find_contacts", { businessId: "biz1", query: "a" }, mine)).rejects.toThrow(/Datos inválidos/);
  });

  it("won't propose changes for another business", async () => {
    await expect(
      buildProposal("propose_agent_enabled", { businessId: "someone-else", enabled: false, explanation: "x" }, mine),
    ).rejects.toThrow(/No tienes acceso/);
  });
});

describe("proposals", () => {
  it("builds a prompt card without writing anything", async () => {
    const p = await buildProposal(
      "propose_agent_prompt",
      { businessId: "biz1", systemPrompt: "Eres parte del equipo de Clínica Sonrisa. ".repeat(3), tone: "cercano", explanation: "Agrega horarios" },
      mine,
    );
    expect(p.kind).toBe("propose_agent_prompt");
    expect(p.preview.title).toMatch(/prompt/i);
    expect(p.preview.body).toContain("Clínica Sonrisa");
  });

  it("normalizes template names and comment keywords", async () => {
    const t = await buildProposal(
      "propose_whatsapp_template",
      { businessId: "biz1", name: "Recordatorio Cita!", category: "UTILITY", bodyText: "Hola, te recordamos tu cita de mañana.", explanation: "x" },
      mine,
    );
    expect(t.payload.name).toBe("recordatorio_cita");

    const r = await buildProposal(
      "propose_comment_rule",
      { businessId: "biz1", name: "Info", keywords: ["INFO", "Cuánto"], networks: ["instagram"], publicReplies: ["¡Hola {nombre}!"], explanation: "x" },
      mine,
    );
    expect(r.payload.keywords).toEqual(["info", "cuanto"]);
  });

  it("asks for content when a rule or broadcast has nothing to send", async () => {
    await expect(
      buildProposal("propose_comment_rule", { businessId: "biz1", name: "x", keywords: ["info"], networks: ["facebook"], publicReplies: [], explanation: "x" }, mine),
    ).rejects.toThrow(/respuesta pública/);
    await expect(buildProposal("propose_broadcast", { businessId: "biz1", explanation: "x" }, mine)).rejects.toThrow(/mensaje o una plantilla/);
  });
});
