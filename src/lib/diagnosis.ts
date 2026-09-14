import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropicClient";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";

const ERROR_PREFIX = "[ERROR INTERNO";

// Below this, a report would be guessing from too little real signal —
// better to say so than to hand back generic-sounding advice dressed up as
// data-driven.
const MIN_CONVERSATIONS = 3;
const MIN_MESSAGES = 12;

// Bounds how much transcript we send per run: enough conversations to see a
// real pattern, not so much that a busy business blows past a sane prompt
// size or cost per click of "Generar diagnóstico".
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 40;

const SalesDiagnosisSchema = z.object({
  resumen: z
    .string()
    .describe("Resumen de 2-3 frases, dirigido al dueño del negocio, sobre cómo está vendiendo el agente hoy."),
  puntuacion: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Puntuación de 1 a 10 de qué tan bien está el agente calificando, generando interés y cerrando ventas."),
  fortalezas: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Cosas concretas que el agente SÍ está haciendo bien en estas conversaciones reales."),
  debilidades: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Problemas concretos y específicos observados en las conversaciones que están costando ventas."),
  recomendaciones: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Acciones concretas y accionables (ajustes de prompt, de estrategia, o de proceso) para vender más."),
});

export type SalesDiagnosis = z.infer<typeof SalesDiagnosisSchema>;

type DiagnosisInput = {
  businessName: string;
  industryLabel: string;
  transcript: string;
  conversationCount: number;
  messageCount: number;
};

async function buildDiagnosisInput(businessId: string): Promise<DiagnosisInput | null> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { name: true, industry: true },
  });

  const conversations = await prisma.conversation.findMany({
    where: { businessId },
    orderBy: { lastMessageAt: "desc" },
    take: MAX_CONVERSATIONS,
    select: {
      stage: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: MAX_MESSAGES_PER_CONVERSATION,
        select: { role: true, content: true, sentByHuman: true },
      },
    },
  });

  const usableConversations = conversations
    .map((c) => ({
      stageName: c.stage.name,
      messages: c.messages.filter((m) => !(m.role === "AGENT" && m.content.startsWith(ERROR_PREFIX))),
    }))
    .filter((c) => c.messages.length > 0);

  const messageCount = usableConversations.reduce((sum, c) => sum + c.messages.length, 0);

  if (usableConversations.length < MIN_CONVERSATIONS || messageCount < MIN_MESSAGES) {
    return null;
  }

  const industryLabel = INDUSTRY_OPTIONS.find((o) => o.value === business.industry)?.label ?? "otro";

  const transcript = usableConversations
    .map((c, i) => {
      const lines = c.messages.map((m) => {
        const speaker = m.role === "CUSTOMER" ? "Cliente" : m.sentByHuman ? "Humano (equipo)" : "IA";
        return `${speaker}: ${m.content}`;
      });
      return `--- Conversación ${i + 1} (etapa actual: ${c.stageName}) ---\n${lines.join("\n")}`;
    })
    .join("\n\n");

  return { businessName: business.name, industryLabel, transcript, conversationCount: usableConversations.length, messageCount };
}

const SYSTEM_PROMPT = `Eres un consultor experto en ventas conversacionales y growth marketing, especializado en auditar conversaciones reales de WhatsApp entre un agente de IA y clientes potenciales.

Tu trabajo es leer transcripciones reales y decirle al dueño del negocio, en términos simples y directos, qué está funcionando y qué le está costando ventas — nunca des consejos genéricos que servirían para cualquier negocio: cada observación debe estar anclada en algo que realmente pasó en las conversaciones que leíste (una objeción mal resuelta, una pregunta de cierre que nunca se hizo, una respuesta demasiado genérica, falta de urgencia, no pedir el siguiente paso, etc.).

Sé específico y accionable. El dueño del negocio no es técnico: no hables de "prompts" ni de IA como tecnología, habla de la conversación y de ventas.`;

export async function generateSalesDiagnosis(
  businessId: string,
): Promise<{ status: "insufficient_data" } | { status: "ok"; diagnosis: SalesDiagnosis }> {
  const input = await buildDiagnosisInput(businessId);
  if (!input) return { status: "insufficient_data" };

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(SalesDiagnosisSchema) },
    messages: [
      {
        role: "user",
        content: `Negocio: ${input.businessName} (rubro: ${input.industryLabel}).\n\nAnalicé ${input.conversationCount} conversaciones reales recientes (${input.messageCount} mensajes en total). Aquí están las transcripciones completas:\n\n${input.transcript}\n\nAuditá estas conversaciones y generá el diagnóstico de ventas.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Claude no devolvió un diagnóstico válido");
  }

  return { status: "ok", diagnosis: response.parsed_output };
}
