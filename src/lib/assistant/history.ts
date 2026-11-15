import type Anthropic from "@anthropic-ai/sdk";

type Message = Anthropic.Beta.BetaMessageParam;

const THINKING = new Set(["thinking", "redacted_thinking"]);

/**
 * The thread as it is sent to the model: the "thinking" blocks of turns that
 * are already finished are left out. They were signed by whichever model wrote
 * them (a thread started on Opus must keep working after the assistant moves
 * to another model), and the API does not need them back once the turn is
 * over. The messages from `keepFrom` on are the turn being answered now, whose
 * thinking has to travel back with its tool results, so they go untouched.
 * The stored thread is never changed: this returns a copy.
 */
export function withoutOldThinking(messages: Message[], keepFrom: number): Message[] {
  return messages.map((m, i) => {
    if (i >= keepFrom || m.role !== "assistant" || typeof m.content === "string") return m;
    const content = m.content.filter((b) => !THINKING.has(b.type));
    if (content.length === m.content.length) return m;
    // A turn that was only thinking still needs some content to keep user/assistant alternating.
    return { ...m, content: content.length > 0 ? content : [{ type: "text", text: "(sin respuesta)" }] };
  });
}
