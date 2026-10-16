// The three videos of the offer landing (/oferta). Paste the links here when
// they are ready: a YouTube or Vimeo link, or the direct link of an .mp4 (for
// example one uploaded to the platform's file storage). An empty string hides
// that slot, so the page works the same before the videos exist.
export const LANDING_VIDEOS = {
  /** Under the headline: the promise in 35 to 45 seconds. */
  hero: { src: "", poster: "" },
  /** In "Cómo funciona": the platform on screen. */
  how: { src: "", poster: "" },
  /** Next to the price: the doubts, answered. */
  trust: { src: "", poster: "" },
} as const;

export type VideoSource = { kind: "youtube" | "vimeo" | "file"; url: string };

/**
 * Turns a pasted link into something that can be played, or null when it is
 * not a link we accept (anything that is not https, or an unknown host).
 */
export function videoSource(raw: string | null | undefined): VideoSource | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{6,20}$/.test(id) ? { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    const id = u.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : null);
    return id && /^[\w-]{6,20}$/.test(id) ? { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean).find((p) => /^\d{5,12}$/.test(p));
    return id ? { kind: "vimeo", url: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "file", url: u.toString() };
  return null;
}
