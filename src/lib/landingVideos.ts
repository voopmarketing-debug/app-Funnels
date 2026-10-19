// The two videos of the offer landing (/oferta). Paste the links here: a
// YouTube or Vimeo link, an https link to an .mp4, or a file kept in this
// project's public folder (for example "/landing/vsl-hero.mp4"). An empty
// string leaves the slot as a placeholder (see SHOW_VIDEO_PLACEHOLDERS).
export const LANDING_VIDEOS = {
  /** Under the headline: the hook and the promise (about 45 seconds). */
  hero: { src: "/landing/vsl-hero.mp4", poster: "/landing/vsl-hero-poster.jpg" },
  /** In "Cómo funciona": the platform on screen. */
  how: { src: "", poster: "" },
} as const;

/**
 * While a video is missing, its slot shows a framed placeholder so the layout
 * (and where each video goes) can be reviewed. Set to false before launch to
 * hide the slots that still have no link.
 */
export const SHOW_VIDEO_PLACEHOLDERS = true;

export type VideoSource = { kind: "youtube" | "vimeo" | "file"; url: string };

/**
 * Turns a pasted link into something that can be played, or null when it is
 * not a link we accept (anything that is not https, or an unknown host).
 */
export function videoSource(raw: string | null | undefined): VideoSource | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  // A file served by this same site (public folder).
  if (/^\/(?!\/)[\w\-./]+\.(mp4|webm|mov)$/i.test(text) && !text.includes("..")) return { kind: "file", url: text };
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
