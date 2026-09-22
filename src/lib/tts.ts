const OPENAI_API_BASE = "https://api.openai.com/v1";

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

/**
 * Converts the agent's text reply into a spoken voice note. `response_format:
 * "opus"` specifically returns Ogg-wrapped Opus audio — the exact format
 * WhatsApp requires to render it as a real push-to-talk bubble (waveform +
 * playback bar) instead of a generic audio-file message.
 */
export async function synthesizeVoiceNote(text: string): Promise<Buffer> {
  const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "opus",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI TTS error (${response.status}): ${body}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Transcribes an inbound WhatsApp voice note to text. Meta never sends a
 * caption for audio messages, so without this the AI agent has no idea what
 * the customer actually said — it would just see an empty message.
 */
export async function transcribeVoiceNote(params: { bytes: Buffer; mimeType: string }): Promise<string | null> {
  const extension = params.mimeType.includes("ogg") ? "ogg" : params.mimeType.includes("mpeg") ? "mp3" : "bin";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(params.bytes)], { type: params.mimeType }), `voice-note.${extension}`);
  form.append("model", "whisper-1");

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAiKey()}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI transcription error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() || null;
}
