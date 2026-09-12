import Anthropic from "@anthropic-ai/sdk";

// .trim() guards against a stray leading/trailing character sneaking into
// the env var from a copy/paste — an invalid key otherwise surfaces as an
// opaque "ByteString" crash deep in the HTTP client instead of a clear error.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim() });

export type AgentHistoryMessage = { role: "user" | "assistant"; content: string };

export async function generateAgentReply(params: {
  systemPrompt: string;
  model: string;
  temperature: number;
  history: AgentHistoryMessage[];
  userMessage: string;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: 1024,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: [...params.history, { role: "user", content: params.userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }

  return textBlock.text;
}
