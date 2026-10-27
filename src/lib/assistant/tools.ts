import { formatMoney } from "@/lib/currency";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getBusinessAnalytics } from "@/lib/analytics";
import { PLAN_LABELS } from "@/lib/plans";
import { WebsiteContentV2Schema } from "@/lib/websiteContentV2";
import { parseKeywords } from "@/lib/commentAutoReply";
import { getClientRows } from "@/lib/clientRows";
import { getProfitabilityReport } from "@/lib/profitability";

// The Asistente Funnels' tools. "Read" tools answer right away from the
// database, scoped to the businesses the person can open. "Propose" tools
// never change anything: they save an AssistantAction the person confirms
// with "Aplicar" (see ./apply.ts), which then runs the platform's own action
// with that person's permissions.

export type AccessibleBusiness = { id: string; name: string; role: string };

const BusinessId = z.string().min(1).max(40).describe("Id del negocio (el del contexto)");

// ---- Read tools ----

const READ_TOOLS = {
  list_my_businesses: {
    description: "Lista los negocios (agentes de WhatsApp) a los que esta persona tiene acceso, con su id.",
    schema: z.object({}),
  },
  get_business: {
    description:
      "Resumen de un negocio: rubro, plan, estado del agente de IA (encendido, tono, largo de respuestas y su prompt actual completo), WhatsApp y redes conectadas, embudos con sus etapas y cuántos contactos hay en cada una.",
    schema: z.object({ businessId: BusinessId }),
  },
  read_conversations: {
    description:
      "Lee las conversaciones de WhatsApp más recientes del negocio (los últimos mensajes de cada una, quién escribió: cliente, IA o humano). Úsalo para ver cómo está respondiendo el agente y proponer mejoras al prompt.",
    schema: z.object({ businessId: BusinessId, limit: z.number().int().min(1).max(15).optional().describe("Cuántas conversaciones (máx. 15, por defecto 8)") }),
  },
  find_contacts: {
    description: "Busca contactos del CRM por nombre o teléfono. Devuelve su id de conversación, etapa y última actividad.",
    schema: z.object({ businessId: BusinessId, query: z.string().min(2).max(60) }),
  },
  get_kpis: {
    description: "Métricas del negocio en los últimos 7 o 30 días: conversaciones, mensajes, tasa de automatización, citas, visitas y clics del sitio, contactos por etapa.",
    schema: z.object({ businessId: BusinessId, days: z.union([z.literal(7), z.literal(30)]).optional() }),
  },
  list_templates: {
    description: "Plantillas de WhatsApp del negocio con su estado de aprobación en Meta.",
    schema: z.object({ businessId: BusinessId }),
  },
  list_products: {
    description: "Productos y servicios del catálogo (inventario) con precio, stock e id.",
    schema: z.object({ businessId: BusinessId }),
  },
  list_websites: {
    description: "Páginas web del negocio (id, nombre, tipo, si se pueden editar con IA) y el texto principal de cada una.",
    schema: z.object({ businessId: BusinessId }),
  },
  list_comment_rules: {
    description: "Reglas de respuesta automática a comentarios de Facebook/Instagram por palabra clave.",
    schema: z.object({ businessId: BusinessId }),
  },
} as const;

// ---- Agency-only read tools (modo agencia) ----

const AGENCY_TOOLS = {
  agency_clients: {
    description:
      "Las cuentas de clientes de la agencia: estado de la membresía (prueba gratis, mes activo, por vencer, vencida, sin tarjeta), cuándo vence o cuándo se cobra la prueba, plan y precio, último pago, WhatsApp conectado, uso de IA del mes y última actividad.",
    schema: z.object({}),
  },
  agency_profitability: {
    description: "Rentabilidad de la agencia en un mes: ingresos, costos de IA por cliente (respuestas, voz, sitios, diagnósticos, asistente), comisiones, costos fijos y margen.",
    schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mes AAAA-MM; por defecto el actual") }),
  },
} as const;

// ---- Propose tools ----

const Explanation = z.string().max(400).describe("Una frase para la persona: qué cambia y por qué");

const PROPOSE_TOOLS = {
  propose_agent_prompt: {
    description:
      "Propone un nuevo prompt (instrucciones) para el agente de IA de WhatsApp del negocio, y opcionalmente su tono y largo de respuestas. La persona lo revisa y toca Aplicar. Escribe el prompt completo, no solo los cambios.",
    schema: z.object({
      businessId: BusinessId,
      systemPrompt: z.string().min(50).max(12000),
      tone: z.enum(["cercano", "profesional", "entusiasta", "formal"]).optional(),
      replyLength: z.enum(["breve", "normal", "detallada"]).optional(),
      explanation: Explanation,
    }),
  },
  propose_agent_enabled: {
    description: "Propone encender o apagar el agente de IA de WhatsApp de todo el negocio.",
    schema: z.object({ businessId: BusinessId, enabled: z.boolean(), explanation: Explanation }),
  },
  propose_whatsapp_template: {
    description:
      "Propone una plantilla de WhatsApp para enviar a aprobación de Meta. name: minúsculas y guiones bajos. Variables como {{1}} no son compatibles aquí: escribe el texto final. Máximo 2 botones de enlace.",
    schema: z.object({
      businessId: BusinessId,
      name: z.string().min(3).max(60),
      category: z.enum(["MARKETING", "UTILITY"]),
      bodyText: z.string().min(10).max(1024),
      buttons: z.array(z.object({ text: z.string().min(1).max(25), url: z.string().url() })).max(2).optional(),
      explanation: Explanation,
    }),
  },
  propose_comment_rule: {
    description:
      "Propone una regla de respuesta automática para comentarios de Facebook/Instagram: si el comentario tiene una palabra clave, responde en público y/o por privado. Usa {nombre} para saludar.",
    schema: z.object({
      businessId: BusinessId,
      name: z.string().min(1).max(60),
      keywords: z.array(z.string().min(1).max(60)).min(1).max(20),
      networks: z.array(z.enum(["facebook", "instagram"])).min(1),
      publicReplies: z.array(z.string().min(1).max(1000)).max(5),
      privateMessage: z.string().max(1000).optional(),
      explanation: Explanation,
    }),
  },
  propose_broadcast: {
    description:
      "Propone una difusión de WhatsApp a todos los contactos o a una etapa del embudo. Con texto libre solo llega a quien escribió en las últimas 24 h; con una plantilla aprobada (templateId) llega a todos. Envía mensajes reales: úsalo solo si la persona lo pidió.",
    schema: z.object({
      businessId: BusinessId,
      stageId: z.string().max(40).optional().describe("Etapa destino; omítelo para todos los contactos"),
      message: z.string().max(1000).optional(),
      templateId: z.string().max(40).optional(),
      explanation: Explanation,
    }),
  },
  propose_move_contacts: {
    description: "Propone mover uno o varios contactos (por id de conversación) a otra etapa del embudo.",
    schema: z.object({ businessId: BusinessId, conversationIds: z.array(z.string().max(40)).min(1).max(50), stageId: z.string().max(40), explanation: Explanation }),
  },
  propose_pipeline_stage: {
    description: "Propone agregar una etapa nueva al final de un embudo.",
    schema: z.object({ businessId: BusinessId, pipelineId: z.string().max(40), name: z.string().min(1).max(40), explanation: Explanation }),
  },
  propose_product: {
    description:
      "Propone crear un producto/servicio en el catálogo, o editar uno existente (con productId; solo envía los campos que cambian). Precios en pesos, sin puntos.",
    schema: z.object({
      businessId: BusinessId,
      productId: z.string().max(40).optional(),
      kind: z.enum(["PRODUCT", "SERVICE"]).optional(),
      name: z.string().min(1).max(80).optional(),
      description: z.string().max(600).optional(),
      price: z.number().min(0).max(1_000_000_000).nullable().optional(),
      currency: z.enum(["COP", "USD", "EUR"]).optional(),
      category: z.string().max(40).nullable().optional(),
      active: z.boolean().optional(),
      stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
      explanation: Explanation,
    }),
  },
  propose_website_edit: {
    description:
      "Propone un cambio en una página web del negocio, descrito en palabras (ej. 'cambia el título por…', 'agrega una sección de preguntas frecuentes'). Solo páginas que list_websites marca como editables con IA.",
    schema: z.object({ businessId: BusinessId, websiteId: z.string().max(40), instruction: z.string().min(5).max(2000), explanation: Explanation }),
  },
} as const;

export type ProposeToolName = keyof typeof PROPOSE_TOOLS;
type ReadToolName = keyof typeof READ_TOOLS;
type AgencyToolName = keyof typeof AGENCY_TOOLS;

export const isProposeTool = (name: string): name is ProposeToolName => name in PROPOSE_TOOLS;

/** Tool definitions sent to Claude (stable order, so the prompt cache holds). */
function toApiTools(entries: [string, { description: string; schema: z.ZodType }][]): Anthropic.Beta.BetaTool[] {
  return entries.map(([name, t]) => {
    const schema = z.toJSONSchema(t.schema) as Record<string, unknown>;
    delete schema.$schema;
    return { name, description: t.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
  });
}

const BUSINESS_READ = Object.entries(READ_TOOLS).filter(([name]) => name !== "list_my_businesses");

/** Working on one business: read it and propose changes to it. */
export const BUSINESS_TOOLS = toApiTools([...BUSINESS_READ, ...Object.entries(PROPOSE_TOOLS)]);
/** Modo agencia: read any client and the agency's numbers; no changes (those happen with a business picked). */
export const AGENCY_MODE_TOOLS = toApiTools([...Object.entries(READ_TOOLS), ...Object.entries(AGENCY_TOOLS)]);

/** Short label the chat shows while/after a read tool runs. */
export const READ_TOOL_LABELS: Record<string, string> = {
  list_my_businesses: "Revisé tus negocios",
  agency_clients: "Revisé tus clientes",
  agency_profitability: "Revisé la rentabilidad",
  get_business: "Revisé la configuración del negocio",
  read_conversations: "Leí tus conversaciones recientes",
  find_contacts: "Busqué en tus contactos",
  get_kpis: "Revisé tus métricas",
  list_templates: "Revisé tus plantillas",
  list_products: "Revisé tu catálogo",
  list_websites: "Revisé tus páginas web",
  list_comment_rules: "Revisé tus respuestas automáticas",
};

export class ToolInputError extends Error {}

function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ToolInputError(`Datos inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  return parsed.data;
}

function requireAccess(businesses: AccessibleBusiness[], businessId: string): AccessibleBusiness {
  const b = businesses.find((x) => x.id === businessId);
  if (!b) throw new ToolInputError("Ese negocio no es el que está activo en el chat. Pídele a la persona que lo elija arriba en el asistente.");
  return b;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** What the tools may see: the active business, or (modo agencia) every client plus the agency's own data. */
export type ToolScope = { businesses: AccessibleBusiness[]; agencyUserId: string | null };

export async function runReadTool(name: string, input: unknown, scope: ToolScope): Promise<unknown> {
  const { businesses } = scope;
  if (name in AGENCY_TOOLS) {
    if (!scope.agencyUserId) throw new ToolInputError(`Herramienta desconocida: ${name}`);
    return runAgencyTool(name as AgencyToolName, input, scope.agencyUserId);
  }
  if (!(name in READ_TOOLS)) throw new ToolInputError(`Herramienta desconocida: ${name}`);
  const tool = name as ReadToolName;
  if (tool === "list_my_businesses") return businesses.map((b) => ({ id: b.id, name: b.name, role: b.role }));
  const { businessId, ...rest } = parseInput(READ_TOOLS[tool].schema, input) as { businessId: string } & Record<string, unknown>;
  requireAccess(businesses, businessId);

  switch (tool) {
    case "get_business": {
      const b = await prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        select: {
          name: true,
          industry: true,
          planTier: true,
          subscriptionEndsAt: true,
          wabaPhoneNumberId: true,
          agent: { select: { enabled: true, tone: true, replyLength: true, systemPrompt: true } },
          socialConnection: { select: { fbPageName: true, igUsername: true } },
          pipelines: {
            orderBy: { position: "asc" },
            select: { id: true, name: true, isDefault: true, stages: { orderBy: { position: "asc" }, select: { id: true, name: true, _count: { select: { conversations: true } } } } },
          },
          _count: { select: { conversations: true, products: true, messageTemplates: true, websites: true } },
        },
      });
      return {
        name: b.name,
        industry: b.industry,
        plan: PLAN_LABELS[b.planTier],
        membershipEndsAt: b.subscriptionEndsAt?.toISOString().slice(0, 10) ?? null,
        whatsappConnected: !!b.wabaPhoneNumberId,
        social: b.socialConnection ? { facebookPage: b.socialConnection.fbPageName, instagram: b.socialConnection.igUsername } : null,
        agent: b.agent ?? "Sin agente configurado",
        pipelines: b.pipelines.map((p) => ({ id: p.id, name: p.name, default: p.isDefault, stages: p.stages.map((s) => ({ id: s.id, name: s.name, contacts: s._count.conversations })) })),
        counts: b._count,
      };
    }
    case "read_conversations": {
      const limit = (rest.limit as number | undefined) ?? 8;
      const conversations = await prisma.conversation.findMany({
        where: { businessId, messages: { some: { role: "CUSTOMER" } } },
        orderBy: { lastMessageAt: "desc" },
        take: limit,
        select: {
          id: true,
          customerName: true,
          stage: { select: { name: true } },
          appointmentAt: true,
          messages: { orderBy: { createdAt: "desc" }, take: 14, select: { role: true, sentByHuman: true, content: true, createdAt: true } },
        },
      });
      return conversations.map((c) => ({
        conversationId: c.id,
        contact: c.customerName ?? "Sin nombre",
        stage: c.stage.name,
        appointment: c.appointmentAt?.toISOString() ?? null,
        // Oldest first, like reading the chat.
        messages: c.messages.reverse().map((m) => `${m.role === "CUSTOMER" ? "Cliente" : m.sentByHuman ? "Humano" : "IA"}: ${clip(m.content, 400)}`),
      }));
    }
    case "find_contacts": {
      const q = String(rest.query).trim();
      const digits = q.replace(/\D/g, "");
      const rows = await prisma.conversation.findMany({
        where: {
          businessId,
          OR: [{ customerName: { contains: q, mode: "insensitive" } }, ...(digits.length >= 4 ? [{ customerPhone: { contains: digits } }] : [])],
        },
        orderBy: { lastMessageAt: "desc" },
        take: 20,
        select: { id: true, customerName: true, customerPhone: true, lastMessageAt: true, stage: { select: { id: true, name: true } } },
      });
      return rows.map((r) => ({ conversationId: r.id, name: r.customerName, phone: r.customerPhone, stage: r.stage, lastMessageAt: r.lastMessageAt.toISOString().slice(0, 10) }));
    }
    case "get_kpis": {
      const a = await getBusinessAnalytics(businessId, rest.days === 7 ? "7d" : "30d");
      return {
        totalConversations: a.totalConversations,
        newConversations: a.newConversations,
        messages: a.messagesByRole,
        automationRate: a.automationRate,
        awaitingReply: a.awaitingReply,
        appointmentsBooked: a.appointmentsBooked,
        appointmentConversionRate: a.appointmentConversionRate,
        websiteViews: a.websiteViews,
        websiteClicksWhatsapp: a.websiteClicksWhatsapp,
        websiteLeads: a.websiteLeads,
        stages: a.stageDistribution,
      };
    }
    case "list_templates": {
      const rows = await prisma.messageTemplate.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, name: true, category: true, status: true, bodyText: true } });
      return rows.map((t) => ({ ...t, bodyText: clip(t.bodyText, 300) }));
    }
    case "list_products": {
      return prisma.product.findMany({
        where: { businessId },
        orderBy: { position: "asc" },
        take: 60,
        select: { id: true, kind: true, name: true, price: true, category: true, active: true, trackStock: true, stock: true },
      });
    }
    case "list_websites": {
      const rows = await prisma.website.findMany({ where: { businessId }, orderBy: { id: "asc" }, take: 20, select: { id: true, name: true, pageType: true, slug: true, content: true } });
      return rows.map((w) => {
        const v2 = WebsiteContentV2Schema.safeParse(w.content);
        return {
          id: w.id,
          name: w.name,
          type: w.pageType,
          url: `/sitio/${w.slug}`,
          editableWithAi: w.pageType === "landing" && v2.success,
          summary: v2.success ? clip(JSON.stringify(v2.data), 1500) : null,
        };
      });
    }
    case "list_comment_rules": {
      return prisma.commentAutoReply.findMany({
        where: { businessId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, keywords: true, networks: true, publicReplies: true, privateMessage: true, enabled: true, replyCount: true },
      });
    }
  }
}

const DAY_MS = 86_400_000;

async function runAgencyTool(tool: AgencyToolName, input: unknown, agencyUserId: string): Promise<unknown> {
  const data = parseInput(AGENCY_TOOLS[tool].schema, input) as { month?: string };
  const now = new Date();
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  if (tool === "agency_clients") {
    const rows = (await getClientRows(agencyUserId, now)) ?? [];
    return rows.map((r) => {
      const left = r.endsAt ? Math.ceil((Date.parse(r.endsAt) - now.getTime()) / DAY_MS) : null;
      const status = r.pendingCard
        ? "sin tarjeta (se registró pero no activó)"
        : left === null
          ? "sin fecha"
          : left <= 0
            ? r.billing === "trial"
              ? "prueba terminada sin pago"
              : "vencida"
            : r.billing === "trial"
              ? "prueba gratis"
              : left <= 7
                ? "por vencer"
                : "mes activo";
      return {
        cliente: r.name,
        email: r.email,
        negocios: r.lines.map((l) => ({ id: l.businessId, nombre: l.name, whatsapp: l.whatsappConnected })),
        estado: status,
        pago: r.billing,
        venceEl: day(r.endsAt),
        diasRestantes: left,
        primerCobroPrueba: day(r.trialChargeAt),
        ultimoPago: day(r.lastPayment),
        plan: r.planLabel,
        precioUsd: r.priceUsd,
        contactosIaEsteMes: r.contacts,
        limiteContactos: r.contactLimit,
        ultimaActividad: day(r.lastActivity),
        clienteDesde: day(r.joinedAt),
      };
    });
  }
  const report = await getProfitabilityReport(agencyUserId, data.month, now);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    mes: report.month,
    mesEnCurso: report.isCurrentMonth,
    totales: { ...report.totals, revenue: round(report.totals.revenue), aiCost: round(report.totals.aiCost), profit: round(report.totals.profit) },
    cuentas: report.accounts.map((a) => ({
      cliente: a.name,
      plan: a.planLabel,
      activa: a.active,
      ingresoUsd: round(a.revenue),
      costoIaUsd: round(a.aiCost),
      desgloseIa: Object.fromEntries(Object.entries(a.breakdown).map(([k, v]) => [k, round(v)])),
      comisionesUsd: round(a.fees),
      gananciaUsd: round(a.profit),
      margen: a.margin,
      contactos: a.contacts,
    })),
  };
}

// ---- Proposals ----

export type ProposalPreview = {
  title: string;
  /** Plain lines shown on the card. */
  lines: { label: string; value: string }[];
  /** Long text (a prompt, a message) shown in a scrollable box. */
  body?: string;
  /** Asks for an extra confirmation (it sends real messages). */
  danger?: string;
};

export type Proposal = { kind: ProposeToolName; businessId: string; payload: Record<string, unknown>; preview: ProposalPreview };

/** Validates a proposal against the database (ids belong to the business) and builds its card. */
export async function buildProposal(name: ProposeToolName, input: unknown, businesses: AccessibleBusiness[]): Promise<Proposal> {
  const data = parseInput(PROPOSE_TOOLS[name].schema, input) as { businessId: string; explanation: string } & Record<string, unknown>;
  const business = requireAccess(businesses, data.businessId);
  const { businessId, explanation, ...payload } = data;
  const base: { kind: ProposeToolName; businessId: string; payload: Record<string, unknown> } = { kind: name, businessId, payload: { ...payload, explanation } };
  const biz = { label: "Negocio", value: business.name };

  switch (name) {
    case "propose_agent_prompt": {
      const p = payload as { systemPrompt: string; tone?: string; replyLength?: string };
      return {
        ...base,
        preview: {
          title: "Nuevo prompt para tu agente de IA",
          lines: [biz, ...(p.tone ? [{ label: "Tono", value: p.tone }] : []), ...(p.replyLength ? [{ label: "Respuestas", value: p.replyLength }] : []), { label: "Por qué", value: explanation }],
          body: p.systemPrompt,
        },
      };
    }
    case "propose_agent_enabled": {
      const on = payload.enabled as boolean;
      return { ...base, preview: { title: on ? "Encender el agente de IA" : "Apagar el agente de IA", lines: [biz, { label: "Por qué", value: explanation }] } };
    }
    case "propose_whatsapp_template": {
      const p = payload as { name: string; category: string; bodyText: string; buttons?: { text: string; url: string }[] };
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)+/g, "");
      if (!slug) throw new ToolInputError("El nombre de la plantilla necesita letras o números");
      base.payload.name = slug;
      return {
        ...base,
        preview: {
          title: "Plantilla de WhatsApp para enviar a Meta",
          lines: [
            biz,
            { label: "Nombre", value: slug },
            { label: "Categoría", value: p.category === "UTILITY" ? "Utilidad" : "Marketing" },
            ...(p.buttons ?? []).map((b, i) => ({ label: `Botón ${i + 1}`, value: `${b.text} → ${b.url}` })),
            { label: "Por qué", value: explanation },
          ],
          body: p.bodyText,
        },
      };
    }
    case "propose_comment_rule": {
      const p = payload as { name: string; keywords: string[]; networks: string[]; publicReplies: string[]; privateMessage?: string };
      if (!p.publicReplies.length && !p.privateMessage) throw new ToolInputError("La regla necesita respuesta pública, mensaje privado o ambos");
      base.payload.keywords = parseKeywords(p.keywords.join(","));
      return {
        ...base,
        preview: {
          title: "Respuesta automática a comentarios",
          lines: [
            biz,
            { label: "Nombre", value: p.name },
            { label: "Palabras clave", value: (base.payload.keywords as string[]).join(", ") },
            { label: "Redes", value: p.networks.map((n) => (n === "facebook" ? "Facebook" : "Instagram")).join(" y ") },
            ...p.publicReplies.map((r, i) => ({ label: p.publicReplies.length > 1 ? `Respuesta pública ${i + 1}` : "Respuesta pública", value: r })),
            ...(p.privateMessage ? [{ label: "Mensaje privado", value: p.privateMessage }] : []),
          ],
        },
      };
    }
    case "propose_broadcast": {
      const p = payload as { stageId?: string; message?: string; templateId?: string };
      if (!p.message && !p.templateId) throw new ToolInputError("La difusión necesita un mensaje o una plantilla aprobada");
      const stage = p.stageId ? await prisma.pipelineStage.findFirst({ where: { id: p.stageId, businessId }, select: { name: true } }) : null;
      if (p.stageId && !stage) throw new ToolInputError("Esa etapa no existe en este negocio. Usa get_business para ver las etapas.");
      const template = p.templateId
        ? await prisma.messageTemplate.findFirst({ where: { id: p.templateId, businessId, status: "APPROVED" }, select: { name: true, bodyText: true } })
        : null;
      if (p.templateId && !template) throw new ToolInputError("Esa plantilla no existe o aún no está aprobada por Meta.");
      const recipients = await prisma.conversation.count({ where: { businessId, ...(p.stageId ? { stageId: p.stageId } : {}) } });
      return {
        ...base,
        preview: {
          title: "Difusión por WhatsApp",
          lines: [
            biz,
            { label: "Para", value: `${stage ? `Etapa «${stage.name}»` : "Todos los contactos"} · ${recipients} contacto${recipients === 1 ? "" : "s"}` },
            { label: "Tipo", value: template ? `Plantilla «${template.name}»` : "Texto libre (solo llega a quien escribió en las últimas 24 h)" },
            { label: "Por qué", value: explanation },
          ],
          body: template?.bodyText ?? p.message,
          danger: `Se enviarán mensajes reales a ${recipients} contacto${recipients === 1 ? "" : "s"}.`,
        },
      };
    }
    case "propose_move_contacts": {
      const p = payload as { conversationIds: string[]; stageId: string };
      const [stage, contacts] = await Promise.all([
        prisma.pipelineStage.findFirst({ where: { id: p.stageId, businessId }, select: { name: true } }),
        prisma.conversation.findMany({ where: { id: { in: p.conversationIds }, businessId }, select: { id: true, customerName: true, customerPhone: true } }),
      ]);
      if (!stage) throw new ToolInputError("Esa etapa no existe en este negocio.");
      if (contacts.length === 0) throw new ToolInputError("Ninguno de esos contactos es de este negocio. Usa find_contacts.");
      base.payload.conversationIds = contacts.map((c) => c.id);
      return {
        ...base,
        preview: {
          title: `Mover ${contacts.length} contacto${contacts.length === 1 ? "" : "s"} a «${stage.name}»`,
          lines: [biz, { label: "Contactos", value: contacts.map((c) => c.customerName ?? c.customerPhone).join(", ") }, { label: "Por qué", value: explanation }],
        },
      };
    }
    case "propose_pipeline_stage": {
      const p = payload as { pipelineId: string; name: string };
      const pipeline = await prisma.pipeline.findFirst({ where: { id: p.pipelineId, businessId }, select: { name: true } });
      if (!pipeline) throw new ToolInputError("Ese embudo no existe en este negocio.");
      return { ...base, preview: { title: `Nueva etapa «${p.name}»`, lines: [biz, { label: "Embudo", value: pipeline.name }, { label: "Por qué", value: explanation }] } };
    }
    case "propose_product": {
      const p = payload as { productId?: string; name?: string; price?: number | null; currency?: string; kind?: string; description?: string; category?: string | null; active?: boolean; stock?: number | null };
      const existing = p.productId ? await prisma.product.findFirst({ where: { id: p.productId, businessId }, select: { name: true, currency: true } }) : null;
      if (p.productId && !existing) throw new ToolInputError("Ese producto no existe en este negocio. Usa list_products.");
      if (!p.productId && !p.name) throw new ToolInputError("Un producto nuevo necesita nombre");
      const priceCurrency = p.currency ?? existing?.currency ?? "COP";
      const money = (v: number) => formatMoney(v, priceCurrency);
      return {
        ...base,
        preview: {
          title: existing ? `Editar «${existing.name}»` : `Nuevo ${p.kind === "SERVICE" ? "servicio" : "producto"}: ${p.name}`,
          lines: [
            biz,
            ...(p.name && existing ? [{ label: "Nombre", value: p.name }] : []),
            ...(p.price !== undefined ? [{ label: "Precio", value: p.price === null ? "Sin precio" : money(p.price) }] : []),
            ...(p.category !== undefined ? [{ label: "Categoría", value: p.category ?? "Sin categoría" }] : []),
            ...(p.stock !== undefined ? [{ label: "Stock", value: p.stock === null ? "Sin controlar" : String(p.stock) }] : []),
            ...(p.active !== undefined ? [{ label: "Visible", value: p.active ? "Sí" : "No" }] : []),
            { label: "Por qué", value: explanation },
          ],
          ...(p.description ? { body: p.description } : {}),
        },
      };
    }
    case "propose_website_edit": {
      const p = payload as { websiteId: string; instruction: string };
      const site = await prisma.website.findFirst({ where: { id: p.websiteId, businessId }, select: { name: true, content: true, pageType: true } });
      if (!site || site.pageType !== "landing" || !WebsiteContentV2Schema.safeParse(site.content).success) {
        throw new ToolInputError("Esa página no se puede editar con IA. Usa list_websites para ver cuáles sí.");
      }
      return { ...base, preview: { title: `Cambiar la página «${site.name}»`, lines: [biz, { label: "Por qué", value: explanation }], body: p.instruction } };
    }
  }
}
