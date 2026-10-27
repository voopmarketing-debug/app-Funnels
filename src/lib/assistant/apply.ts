import { prisma } from "@/lib/prisma";
import {
  addPipelineStage,
  applyWebsitePromptV2,
  createMessageTemplate,
  sendBroadcast,
  toggleAgentEnabled,
  updateAgent,
  updateConversationStage,
} from "@/lib/actions";
import { saveProduct, type ProductInput } from "@/lib/productActions";
import { saveCommentAutoReply } from "@/lib/socialActions";
import type { ProposeToolName } from "./tools";

// Runs a confirmed proposal through the platform's own server actions, so
// each one re-checks the signed-in person's permissions exactly as if they
// had used that screen. Returns a sentence for the chat.

type Payload = Record<string, unknown>;

function form(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v);
  return fd;
}

export async function executeProposal(kind: ProposeToolName, businessId: string, p: Payload): Promise<string> {
  switch (kind) {
    case "propose_agent_prompt": {
      const current = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { industry: true, agent: { select: { tone: true, replyLength: true } } } });
      await updateAgent(
        businessId,
        form({
          systemPrompt: String(p.systemPrompt),
          tone: (p.tone as string | undefined) ?? current.agent?.tone ?? "cercano",
          replyLength: (p.replyLength as string | undefined) ?? current.agent?.replyLength ?? "breve",
          industry: current.industry ?? "otro",
        }),
      );
      return "Listo: tu agente ya usa el prompt nuevo en las próximas respuestas.";
    }
    case "propose_agent_enabled":
      await toggleAgentEnabled(businessId, Boolean(p.enabled));
      return p.enabled ? "Listo: el agente de IA quedó encendido." : "Listo: el agente de IA quedó apagado.";
    case "propose_whatsapp_template": {
      const buttons = (p.buttons as { text: string; url: string }[] | undefined) ?? [];
      const res = await createMessageTemplate(
        businessId,
        form({
          name: String(p.name),
          language: "es",
          category: String(p.category),
          bodyText: String(p.bodyText),
          button1Text: buttons[0]?.text,
          button1Url: buttons[0]?.url,
          button2Text: buttons[1]?.text,
          button2Url: buttons[1]?.url,
        }),
      );
      if (!res.ok) throw new Error(res.error);
      return `Listo: la plantilla «${res.name}» se envió a Meta. La aprobación suele tardar desde minutos hasta 24 horas; míralo en Plantillas.${res.renamedFrom ? ` (Se llamó «${res.name}» porque Meta todavía tiene reservado el nombre «${res.renamedFrom}».)` : ""}`;
    }
    case "propose_comment_rule": {
      const res = await saveCommentAutoReply(businessId, null, {
        name: String(p.name),
        keywords: (p.keywords as string[]).join(", "),
        networks: p.networks as string[],
        publicReplies: p.publicReplies as string[],
        privateMessage: (p.privateMessage as string | undefined) ?? "",
      });
      if (!res.ok) throw new Error(res.error);
      return `Listo: la regla quedó activa.${res.warning ? ` ${res.warning}` : ""}`;
    }
    case "propose_broadcast": {
      const res = await sendBroadcast(
        businessId,
        form({ stageId: (p.stageId as string | undefined) ?? "all", message: p.message as string | undefined, templateId: p.templateId as string | undefined }),
      );
      if ("error" in res) throw new Error(res.error);
      return `Difusión enviada: ${res.sentCount} de ${res.totalRecipients} mensajes salieron${res.failedCount ? ` (${res.failedCount} no se pudieron enviar)` : ""}. Mira el detalle en CRM → Difusiones.`;
    }
    case "propose_move_contacts": {
      const ids = p.conversationIds as string[];
      for (const id of ids) await updateConversationStage(businessId, id, String(p.stageId));
      return `Listo: ${ids.length === 1 ? "el contacto quedó" : `los ${ids.length} contactos quedaron`} en la etapa nueva.`;
    }
    case "propose_pipeline_stage":
      await addPipelineStage(businessId, String(p.pipelineId), form({ name: String(p.name) }));
      return `Listo: la etapa «${p.name}» ya está en tu embudo.`;
    case "propose_product": {
      const productId = (p.productId as string | undefined) ?? null;
      const existing = productId ? await prisma.product.findFirstOrThrow({ where: { id: productId, businessId } }) : null;
      const pick = <T,>(key: string, fallback: T): T => (p[key] !== undefined ? (p[key] as T) : fallback);
      const input: ProductInput = {
        kind: pick("kind", existing?.kind ?? "PRODUCT"),
        name: pick("name", existing?.name ?? ""),
        description: pick("description", existing?.description ?? ""),
        price: pick("price", existing?.price ?? null),
        compareAtPrice: existing?.compareAtPrice ?? null,
        currency: pick("currency", existing?.currency ?? "COP"),
        category: pick("category", existing?.category ?? null),
        badge: existing?.badge ?? null,
        imageUrl: existing?.imageUrl ?? null,
        active: pick("active", existing?.active ?? true),
        trackStock: p.stock !== undefined ? p.stock !== null : existing?.trackStock ?? false,
        stock: pick("stock", existing?.stock ?? null),
        lowStockAt: existing?.lowStockAt ?? null,
      };
      const res = await saveProduct(businessId, productId, input);
      if (!res.ok) throw new Error(res.error);
      return existing ? `Listo: «${input.name}» quedó actualizado en tu catálogo.` : `Listo: «${input.name}» ya está en tu catálogo y el agente lo puede ofrecer.`;
    }
    case "propose_website_edit": {
      const res = await applyWebsitePromptV2(businessId, String(p.websiteId), String(p.instruction));
      if (!res.ok) throw new Error(res.error);
      return "Listo: la página quedó actualizada. Ábrela en Sitio web para verla.";
    }
  }
}
