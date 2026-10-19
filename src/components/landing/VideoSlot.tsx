"use client";

import { useState } from "react";
import { SHOW_VIDEO_PLACEHOLDERS, videoSource } from "@/lib/landingVideos";
import { IconPlay } from "./Icons";

/**
 * A video that loads only when someone taps play: the page opens as fast as
 * if it had no video. Without a valid link it shows a framed placeholder (see
 * SHOW_VIDEO_PLACEHOLDERS) or nothing at all.
 */
export function VideoSlot({ src, poster, title, caption, slot, hint }: { src: string; poster?: string; title: string; caption?: string; slot: string; hint?: string }) {
  const [playing, setPlaying] = useState(false);
  const source = videoSource(src);
  if (!source && !SHOW_VIDEO_PLACEHOLDERS) return null;

  const play = () => {
    setPlaying(true);
    (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({ event: "video_play", slot });
  };

  return (
    <figure className="w-full" data-video-slot={slot}>
      <div className="lp-vframe">
        <div className="lp-vframe-in relative aspect-video w-full">
          {!source ? (
            <div className="lp-vph absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="lp-play" aria-hidden="true">
                <IconPlay size={30} />
              </span>
              <p className="max-w-md text-base font-semibold text-white sm:text-lg">{title}</p>
              <p className="lp-eyebrow !text-white/50">{hint ?? "Aquí va el video"}</p>
            </div>
          ) : playing ? (
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
              onClick={play}
              aria-label={`Reproducir: ${title}`}
              className="group absolute inset-0 flex items-center justify-center"
              style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!poster && <span className="lp-vph absolute inset-0" />}
              <span className="absolute inset-0 bg-black/30 transition group-hover:bg-black/15" />
              <span className="lp-play relative">
                <IconPlay size={30} />
              </span>
              {!poster && <span className="absolute bottom-5 left-5 right-5 text-left text-sm font-semibold text-white">{title}</span>}
            </button>
          )}
        </div>
      </div>
      {caption && <figcaption className="mt-3 text-center text-xs text-ink-muted">{caption}</figcaption>}
    </figure>
  );
}
