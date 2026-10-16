"use client";

import { useState } from "react";
import { videoSource } from "@/lib/landingVideos";

/**
 * A video that loads only when someone taps play: the page opens as fast as
 * if it had no video. Shows nothing when there is no valid link yet.
 */
export function VideoSlot({ src, poster, title, caption, slot }: { src: string; poster?: string; title: string; caption?: string; slot: string }) {
  const [playing, setPlaying] = useState(false);
  const source = videoSource(src);
  if (!source) return null;

  return (
    <figure className="w-full" data-video-slot={slot}>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
        {playing ? (
          source.kind === "file" ? (
            <video src={source.url} poster={poster || undefined} controls autoPlay playsInline className="h-full w-full" />
          ) : (
            <iframe
              src={`${source.url}${source.kind === "youtube" ? "?autoplay=1&rel=0&modestbranding=1" : "?autoplay=1"}`}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Reproducir: ${title}`}
            className="group absolute inset-0 flex items-center justify-center"
            style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "linear-gradient(135deg,#1d5413,#2c7a1d 55%,#0f2f0a)" }}
          >
            <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/15" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#1d5413] shadow-xl transition group-hover:scale-105 sm:h-20 sm:w-20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
            {!poster && <span className="absolute bottom-4 left-4 right-4 text-left text-sm font-semibold text-white drop-shadow">{title}</span>}
          </button>
        )}
      </div>
      {caption && <figcaption className="mt-2 text-center text-xs text-ink-muted">{caption}</figcaption>}
    </figure>
  );
}
