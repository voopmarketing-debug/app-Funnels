/** Escapes text before it goes inside an HTML email or page: names and emails come from people typing into forms. */
export function escapeHtml(text: string | null | undefined): string {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
