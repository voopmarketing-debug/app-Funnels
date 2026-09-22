"use client";

import { useEffect, useRef, useState } from "react";

// WhatsApp-style "jump to latest" behavior: auto-scrolls to the bottom on
// load and whenever a new message arrives, but once the admin scrolls up
// to read older history it stops yanking them back down — instead it
// shows a floating arrow (like WhatsApp's) to jump back to the latest
// message on demand.
export function MessageScrollArea({ messageCount, children }: { messageCount: number; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpButton, setShowJumpButton] = useState(false);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  useEffect(() => {
    scrollToBottom();
    setShowJumpButton(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpButton(distanceFromBottom > 300);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} onScroll={handleScroll} className="h-full space-y-3 overflow-y-auto bg-background px-4 py-4">
        {children}
      </div>
      {showJumpButton && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Ir al último mensaje"
          title="Ir al último mensaje"
          className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-lg transition hover:border-accent hover:text-accent"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
