import Anthropic from "@anthropic-ai/sdk";

// API keys are always plain ASCII. Stripping anything else defends against
// a stray character sneaking in from a copy/paste of a masked/partial key
// view — e.g. a bullet character (•) — which otherwise sits silently in the
// Authorization header and surfaces as an opaque "ByteString" crash deep in
// the HTTP client on every single request, instead of a clear auth error.
function sanitizeAsciiToken(value: string): string {
  return value.replace(/[^\x21-\x7E]/g, "");
}

const anthropic = new Anthropic({
  apiKey: sanitizeAsciiToken(process.env.ANTHROPIC_API_KEY ?? ""),
});

export type AgentHistoryMessage = { role: "user" | "assistant"; content: string };

export async function generateAgentReply(params: {
  systemPrompt: string;
  model: string;
  temperature: number;
  history: AgentHistoryMessage[];
  userMessage: string;
}): Promise<string> {
  // `temperature` is deprecated/rejected on this model — omit it rather than
  // fail every single request with a 400.
  const response = await anthropic.messages.create({
    model: params.model,
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: [...params.history, { role: "user", content: params.userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude did not return a text response");
  }

  return textBlock.text;
}
