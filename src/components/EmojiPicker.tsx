"use client";

import { useEffect, useRef, useState } from "react";

// A curated set instead of a full emoji library: it's what businesses
// actually use when chatting with customers (greetings, thanks, products,
// money, dates, delivery), it ships as a few KB with no dependency, and
// it renders with the device's own emoji font, exactly as WhatsApp will.
const CATEGORIES: { id: string; label: string; icon: string; emojis: string[] }[] = [
  {
    id: "smileys",
    label: "Caras",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘",
      "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑",
      "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😴", "😷", "🤒", "🤕", "🤢", "🥵", "🥶", "🥴", "😵",
      "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "🥹",
      "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤",
      "😡", "😠", "🤬", "😈", "💀", "🤡", "👻", "👽", "🤖", "😺", "😸", "😻",
    ],
  },
  {
    id: "gestures",
    label: "Gestos",
    icon: "👍",
    emojis: [
      "👍", "👎", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚",
      "🖐️", "🖖", "👋", "🤝", "🙏", "👏", "🙌", "👐", "🤲", "💪", "✍️", "🫶", "👀", "🧠", "🫡", "🤷",
      "🤷‍♀️", "🤷‍♂️", "🙋", "🙋‍♀️", "🙋‍♂️", "💁", "💁‍♀️", "🙆", "🙅", "🤦", "🧑‍💻", "🧑‍💼", "👩‍⚕️", "👨‍🍳",
    ],
  },
  {
    id: "hearts",
    label: "Corazones",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💯", "✨", "⭐", "🌟", "💫", "🔥", "💥", "🎉", "🎊", "🎁", "🏆", "🥇", "🎯", "🚀",
    ],
  },
  {
    id: "business",
    label: "Negocio",
    icon: "💼",
    emojis: [
      "💼", "💰", "💵", "💳", "🧾", "💸", "🤑", "📈", "📊", "📉", "🛒", "🛍️", "🏷️", "📦", "🚚", "🏪",
      "🏢", "🏠", "📍", "🗺️", "📅", "📆", "🗓️", "⏰", "⏳", "⌛", "📞", "📱", "💻", "📧", "📩", "📨",
      "📝", "📌", "📎", "🔗", "📄", "📋", "📸", "🎥", "🔑", "🔒", "✅", "☑️", "✔️", "❌", "⚠️", "❗",
      "❓", "ℹ️", "🆕", "🆓", "🔝", "🆗", "🔄", "⬇️", "➡️", "🔔", "📢", "💡", "🛠️", "⚙️",
    ],
  },
  {
    id: "food",
    label: "Comida",
    icon: "🍕",
    emojis: [
      "🍕", "🍔", "🍟", "🌭", "🥪", "🌮", "🌯", "🥗", "🍝", "🍜", "🍣", "🍱", "🥘", "🍗", "🥩", "🍳",
      "🥞", "🧇", "🥐", "🍞", "🧀", "🥑", "🍎", "🍓", "🍌", "🍉", "🍇", "🍍", "🥭", "🍒", "🍰", "🎂",
      "🧁", "🍩", "🍪", "🍫", "🍦", "☕", "🍵", "🧃", "🥤", "🧋", "🍺", "🍷", "🍸", "🥂",
    ],
  },
  {
    id: "nature",
    label: "Naturaleza",
    icon: "🌸",
    emojis: [
      "🌸", "🌹", "🌺", "🌻", "🌼", "🌷", "💐", "🌱", "🌿", "🍀", "🌳", "🌴", "🌵", "🍁", "☀️", "🌤️",
      "⛅", "🌧️", "⛈️", "❄️", "🌈", "🌙", "🌎", "🌊", "🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🦁", "🐯",
      "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🦋", "🐝",
    ],
  },
  {
    id: "activities",
    label: "Actividades",
    icon: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏋️", "🧘", "🏃", "🚴", "🏊", "💃", "🕺", "🎵", "🎶", "🎤",
      "🎧", "🎸", "🎮", "🎨", "🎬", "📚", "✈️", "🏖️", "🏝️", "🚗", "🏍️", "🚲", "💅", "💇", "💆", "🛁",
    ],
  },
];

const RECENTS_KEY = "fl-recent-emojis";
const MAX_RECENTS = 16;

function readRecents(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

/**
 * Emoji button + popover for a message composer. Stays open so several
 * emojis can be added in a row; closes on outside click or Escape.
 */
export function EmojiPicker({
  onPick,
  disabled = false,
  buttonClassName,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
  /** Replaces the default round bordered trigger (e.g. a toolbar icon button). */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);
  // Fixed-positioned from the button's rect, so the panel never runs off a
  // narrow phone screen or gets clipped by a scrolling/overflow-hidden parent.
  const [position, setPosition] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function measure() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(320, window.innerWidth - 16);
    return {
      width,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      bottom: window.innerHeight - rect.top + 8,
    };
  }

  useEffect(() => {
    if (!open) return;
    function place(e?: Event) {
      // Scrolling the emoji grid itself doesn't move the button.
      if (e?.target instanceof Node && rootRef.current?.contains(e.target)) return;
      setPosition(measure());
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setRecents(readRecents());
      setPosition(measure());
    }
    setOpen((o) => !o);
  }

  function pick(emoji: string) {
    onPick(emoji);
    const next = [emoji, ...recents.filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
    setRecents(next);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Recents just won't persist.
    }
  }

  function jumpTo(id: string) {
    setActiveId(id);
    const section = scrollRef.current?.querySelector<HTMLElement>(`[data-emoji-section="${id}"]`);
    if (section && scrollRef.current) scrollRef.current.scrollTo({ top: section.offsetTop, behavior: "smooth" });
  }

  const sections = recents.length > 0 ? [{ id: "recents", label: "Recientes", icon: "🕘", emojis: recents }, ...CATEGORIES] : CATEGORIES;

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        title="Emojis"
        aria-label="Insertar emoji"
        aria-expanded={open}
        className={
          buttonClassName
            ? `${buttonClassName} ${open ? "text-accent" : ""}`
            : `flex h-9 w-9 items-center justify-center rounded-full border text-lg transition disabled:opacity-60 ${
                open ? "border-accent text-accent" : "border-border text-ink-muted hover:border-accent hover:text-accent"
              }`
        }
      >
        {buttonClassName ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
            <path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.6" />
          </svg>
        ) : (
          "😊"
        )}
      </button>
      {open && position && (
        <div
          role="dialog"
          aria-label="Emojis"
          style={{ left: position.left, bottom: position.bottom, width: position.width }}
          className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        >
          <div className="flex gap-0.5 overflow-x-auto border-b border-border px-1.5 py-1">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpTo(s.id)}
                title={s.label}
                aria-label={s.label}
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-md text-base transition ${
                  activeId === s.id ? "bg-accent/15" : "hover:bg-surface-2"
                }`}
              >
                {s.icon}
              </button>
            ))}
          </div>
          <div ref={scrollRef} className="relative h-64 overflow-y-auto overscroll-contain px-1.5 pb-2">
            {sections.map((s) => (
              <section key={s.id} data-emoji-section={s.id}>
                <h4 className="sticky top-0 bg-surface px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  {s.label}
                </h4>
                <div className="grid grid-cols-8 gap-0.5">
                  {s.emojis.map((emoji, i) => (
                    <button
                      key={`${s.id}-${i}`}
                      type="button"
                      onClick={() => pick(emoji)}
                      className="flex aspect-square items-center justify-center rounded-md text-xl leading-none transition hover:bg-surface-2 active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
