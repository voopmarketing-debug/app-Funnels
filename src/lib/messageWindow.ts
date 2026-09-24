const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether Meta's 24h free-form messaging window is still open for a
 * conversation — true only if the customer's own last message was sent
 * within the last 24h. Once it closes, a free-text reply gets silently
 * rejected by WhatsApp; only an approved template can reopen it (see
 * TemplateSendButton / sendTemplateMessage).
 */
export function isReplyWindowOpen(messages: { role: "AGENT" | "CUSTOMER"; createdAt: Date }[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "CUSTOMER") return Date.now() - m.createdAt.getTime() < REPLY_WINDOW_MS;
  }
  // No inbound message ever — nothing to reopen, so no free-form window exists.
  return false;
}
