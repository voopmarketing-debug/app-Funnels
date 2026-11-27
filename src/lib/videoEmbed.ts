// Options of an embedded video (start and end time, autoplay, mute, loop, controls, related videos),
// as the player of each platform understands them.

export type VideoProvider = "youtube" | "vimeo" | "wistia" | "loom";

export type VideoOpts = {
  /** Seconds from the start of the video. */
  start?: number;
  end?: number;
  autoplay?: boolean;
  mute?: boolean;
  loop?: boolean;
  /** false hides the player's controls. */
  controls?: boolean;
  /** false shows no related videos at the end (YouTube). */
  related?: boolean;
};

export const VIDEO_PROVIDERS: { key: VideoProvider; label: string; placeholder: string }[] = [
  { key: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/watch?v=…" },
  { key: "vimeo", label: "Vimeo", placeholder: "https://vimeo.com/123456789" },
  { key: "wistia", label: "Wistia", placeholder: "https://tu-cuenta.wistia.com/medias/…" },
  { key: "loom", label: "Loom", placeholder: "https://www.loom.com/share/…" },
];

/** What each player can do. */
export const VIDEO_CAPS: Record<VideoProvider, Record<keyof VideoOpts, boolean>> = {
  youtube: { start: true, end: true, autoplay: true, mute: true, loop: true, controls: true, related: true },
  vimeo: { start: true, end: false, autoplay: true, mute: true, loop: true, controls: true, related: false },
  wistia: { start: true, end: false, autoplay: true, mute: true, loop: true, controls: true, related: false },
  loom: { start: true, end: false, autoplay: true, mute: false, loop: false, controls: false, related: false },
};

export function providerOf(embedUrl: string | null | undefined): VideoProvider | null {
  if (!embedUrl) return null;
  if (embedUrl.startsWith("https://www.youtube.com/embed/")) return "youtube";
  if (embedUrl.startsWith("https://player.vimeo.com/video/")) return "vimeo";
  if (embedUrl.startsWith("https://fast.wistia.net/embed/iframe/")) return "wistia";
  if (embedUrl.startsWith("https://www.loom.com/embed/")) return "loom";
  return null;
}

/** The embed address with the owner's options added. Autoplay always goes muted (browsers refuse it otherwise). */
export function withVideoOptions(embedUrl: string, o: VideoOpts | undefined, opts: { preview?: boolean } = {}): string {
  const p = providerOf(embedUrl);
  if (!p || !o) return embedUrl;
  const q = new URLSearchParams();
  const auto = !!o.autoplay && !opts.preview;
  const muted = !!o.mute || auto;
  const id = embedUrl.slice(embedUrl.lastIndexOf("/") + 1);
  if (p === "youtube") {
    if (o.start) q.set("start", String(o.start));
    if (o.end) q.set("end", String(o.end));
    if (auto) q.set("autoplay", "1");
    if (muted) q.set("mute", "1");
    if (o.loop) {
      q.set("loop", "1");
      q.set("playlist", id);
    }
    if (o.controls === false) q.set("controls", "0");
    if (o.related === false) q.set("rel", "0");
  } else if (p === "vimeo") {
    if (auto) q.set("autoplay", "1");
    if (muted) q.set("muted", "1");
    if (o.loop) q.set("loop", "1");
    if (o.controls === false) q.set("controls", "0");
  } else if (p === "wistia") {
    if (o.start) q.set("time", String(o.start));
    if (auto) q.set("autoPlay", "true");
    if (muted) q.set("muted", "true");
    if (o.loop) q.set("endVideoBehavior", "loop");
    if (o.controls === false) q.set("controlsVisibleOnLoad", "false");
  } else if (p === "loom") {
    if (o.start) q.set("t", String(o.start));
    if (auto) q.set("autoplay", "true");
  }
  const query = q.toString();
  const hash = p === "vimeo" && o.start ? `#t=${o.start}s` : "";
  return `${embedUrl}${query ? `?${query}` : ""}${hash}`;
}
