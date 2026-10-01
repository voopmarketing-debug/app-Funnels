"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows a real web page (an iframe at desktop or phone width) shrunk to fit
 * its container, so a thumbnail is the actual design, not a drawing of it.
 * `interactive` lets the person scroll the big preview; thumbnails stay
 * inert so the whole card remains one click target.
 */
export function ScaledPagePreview({
  src,
  viewportWidth = 1280,
  aspect = 0.62,
  interactive = false,
  title,
  className = "",
}: {
  src: string;
  viewportWidth?: number;
  aspect?: number; // container height / width
  interactive?: boolean;
  title: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / viewportWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportWidth]);

  return (
    <div ref={boxRef} className={`relative w-full overflow-hidden bg-surface ${className}`} style={{ aspectRatio: `${1 / aspect}` }}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-border/40" aria-hidden="true" />}
      {scale > 0 && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          tabIndex={interactive ? 0 : -1}
          onLoad={() => setLoaded(true)}
          className={`absolute left-0 top-0 origin-top-left border-0 transition-opacity ${loaded ? "opacity-100" : "opacity-0"} ${interactive ? "" : "pointer-events-none"}`}
          style={{ width: viewportWidth, height: (viewportWidth * aspect) / 1, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
