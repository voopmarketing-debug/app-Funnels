"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A page at the width of the chosen device ("Computador" is 1280 px wide, "Celular" 390 px),
 * shrunk to fit when the screen is narrower, so on a phone the desktop view is the real
 * desktop layout and not the phone layout again.
 */
export function DevicePreviewFrame({ src, device }: { src: string; device: "desktop" | "mobile" }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const designWidth = device === "desktop" ? 1280 : 390;
  const scale = box.w > 0 ? Math.min(1, box.w / designWidth) : 1;
  return (
    <div ref={boxRef} className="h-full w-full overflow-hidden">
      {box.w > 0 && (
        <iframe
          src={src}
          title="Vista previa completa"
          className="origin-top-left border-0"
          style={{ width: designWidth, height: box.h / scale, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
