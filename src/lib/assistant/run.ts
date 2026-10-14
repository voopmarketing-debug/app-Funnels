import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropicClient";
import { prisma } from "@/lib/prisma";
import { recordAnthropicUsage, withAiUsage } from "@/lib/aiUsage";
import { ASSISTANT_SYSTEM_PROMPT } from "./prompt";
import { ASSISTANT_TOOLS, ToolInputError, buildProposal, isProposeTool, runReadTool, type AccessibleBusiness } from "./tools";

export const ASSISTANT_MODEL = "claude-opus-5-5";
// Tool calls per message the person sends: plenty for "read 3 things, propose 2".
const MAX_ITERATIONS = 8;

type Message = Anthropic.Beta.BetaMessageParam;

/** Every business the person can open, with their role (the assistant's whole scope). */
export async function accessibleBusinesses(userId: string): Promise<AccessibleBusiness[]> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, business: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({ id: r.business.id, name: r.business.name, role: r.role }));
}

/** Where the person is, written into their message (not the system prompt, so the cache holds). */
export function contextNote(businesses: AccessibleBusiness[], current: AccessibleBusiness | null, pageLabel: string | null): string {
  const lines = [
    current ? `Negocio en pantalla: ${current.name} (id ${current.id}).` : "No hay un negocio abierto en pantalla.",
    pageLabel ? `Sección abierta: ${pageLabel}.` : null,
    businesses.length > 1 ? `Tiene acceso a ${businesses.length} negocios.` : null,
  ].filter(Boolean);
  return `[Contexto de la plataforma: ${lines.join(" ")}]`;
}

/**
 * Runs Claude on the thread until it answers: read tools execute, propose
 * tools save a pending AssistantAction. Appends to `messages` in place (the
 * history is append-only, so thinking blocks stay valid).
 */
export async function runAssistant(params: {
  threadId: string;
  userId: string;
  chargeBusinessId: string | null;
  businesses: AccessibleBusiness[];
  messages: Message[];
}): Promise<void> {
  const { threadId, userId, businesses, messages } = params;

  const loop = async () => {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.beta.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: [{ type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: ASSISTANT_TOOLS,
        messages,
      });
      await recordAnthropicUsage(ASSISTANT_MODEL, response.usage as Anthropic.Usage);
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") {
        messages.push({ role: "user", content: [{ type: "text", text: "[La plataforma: esa respuesta no se pudo generar. Explícale a la persona en una frase que no puedes ayudar con eso.]" }] });
        continue;
      }
      if (response.stop_reason === "pause_turn") continue;
      if (response.stop_reason !== "tool_use") return;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          if (isProposeTool(block.name)) {
            const proposal = await buildProposal(block.name, block.input, businesses);
            await prisma.assistantAction.create({
              data: {
                threadId,
                userId,
                businessId: proposal.businessId,
                toolUseId: block.id,
                kind: proposal.kind,
                payload: { ...proposal.payload, preview: proposal.preview } as object,
              },
            });
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "Propuesta mostrada a la persona con el botón Aplicar. Todavía no se aplicó: dile qué revisar.",
            });
          } else {
            const data = await runReadTool(block.name, block.input, businesses);
            results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(data) });
          }
        } catch (err) {
          if (!(err instanceof ToolInputError)) console.error(`[assistant] tool ${block.name} failed`, err);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: err instanceof ToolInputError ? err.message : "No se pudo leer esa información ahora.",
          });
        }
      }
      // All results of a turn go back together in one message.
      messages.push({ role: "user", content: results });
    }
    // Out of iterations: close the turn with a plain note so the chat isn't left mid-tool.
    messages.push({ role: "user", content: [{ type: "text", text: "[La plataforma: resume en una frase lo que alcanzaste a hacer y qué falta.]" }] });
    const last = await anthropic.beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: ASSISTANT_TOOLS,
      messages,
    });
    await recordAnthropicUsage(ASSISTANT_MODEL, last.usage as Anthropic.Usage);
    messages.push({ role: "assistant", content: last.content });
  };

  if (params.chargeBusinessId) await withAiUsage(params.chargeBusinessId, "ASSISTANT", loop);
  else await loop();
}
