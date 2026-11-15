import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { withoutOldThinking } from "./history";

type Message = Anthropic.Beta.BetaMessageParam;

const thinking = { type: "thinking", thinking: "…", signature: "sig" } as never;
const redacted = { type: "redacted_thinking", data: "x" } as never;
const text = (t: string) => ({ type: "text", text: t }) as never;
const toolUse = { type: "tool_use", id: "t1", name: "leer", input: {} } as never;

describe("withoutOldThinking", () => {
  it("drops the thinking of finished turns and keeps the rest of each message", () => {
    const messages: Message[] = [
      { role: "user", content: "hola" },
      { role: "assistant", content: [thinking, text("Hola, ¿en qué te ayudo?")] },
      { role: "user", content: "mis métricas" },
    ];
    const out = withoutOldThinking(messages, 2);
    expect(out[1]).toEqual({ role: "assistant", content: [text("Hola, ¿en qué te ayudo?")] });
    expect(out[0]).toBe(messages[0]);
    expect(out[2]).toBe(messages[2]);
  });

  it("leaves the turn in progress untouched: its thinking must go back with the tool result", () => {
    const messages: Message[] = [
      { role: "user", content: "hola" },
      { role: "assistant", content: [thinking, text("listo")] },
      { role: "user", content: "mis métricas" }, // current turn starts here (keepFrom = 2)
      { role: "assistant", content: [thinking, toolUse] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] },
    ];
    const out = withoutOldThinking(messages, 2);
    expect(out[3]).toBe(messages[3]);
    expect(out[1]).toEqual({ role: "assistant", content: [text("listo")] });
  });

  it("removes redacted thinking too and never leaves a message empty", () => {
    const messages: Message[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: [redacted, thinking] },
      { role: "user", content: "b" },
    ];
    expect(withoutOldThinking(messages, 2)[1]).toEqual({ role: "assistant", content: [text("(sin respuesta)")] });
  });

  it("does not change the stored thread", () => {
    const messages: Message[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: [thinking, text("b")] },
      { role: "user", content: "c" },
    ];
    withoutOldThinking(messages, 2);
    expect((messages[1].content as unknown[]).length).toBe(2);
  });
});
