"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

export type AnnouncementView = {
  id: string;
  title: string;
  body: string;
  badge: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

function CtaLink({ href, label, className }: { href: string; label: string; className: string }) {
  // In-app paths navigate inside the platform; anything else opens in a new tab.
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {label}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}

const DISMISS_KEY = "fl-dismissed-banner";

/**
 * The campaign-style hero at the top of Inicio. Closing it is remembered
 * per announcement in this browser, so a NEW banner shows again even after
 * the previous one was dismissed. `preview` (admin editor) never hides.
 */
export function AnnouncementBanner({ announcement, preview = false }: { announcement: AnnouncementView; preview?: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (preview) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists in the browser, after hydration
      setDismissed(localStorage.getItem(DISMISS_KEY) === announcement.id);
    } catch {
      // Storage unavailable — the banner just stays visible.
    }
  }, [announcement.id, preview]);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, announcement.id);
    } catch {
      // Not persisted — it'll show again on the next visit.
    }
  }

  return (
    <section className="fl-card-hero @container relative overflow-hidden p-5 md:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(var(--glow-accent), 0.55), transparent 70%)" }}
      />
      {!preview && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar anuncio"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink"
        >
          ✕
        </button>
      )}
      <div className="relative grid items-center gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="space-y-3">
          {announcement.badge && (
            <span className="inline-block rounded-full bg-accent/15 px-2.5 py-1 text-[13px] font-semibold uppercase tracking-wide text-accent">
              {announcement.badge}
            </span>
          )}
          <h2 className="text-balance text-2xl font-bold leading-tight text-ink @2xl:text-3xl">{announcement.title}</h2>
          <p className="max-w-prose whitespace-pre-line text-sm text-ink-muted md:text-base">{announcement.body}</p>
          {announcement.ctaUrl && announcement.ctaLabel && (
            <CtaLink
              href={announcement.ctaUrl}
              label={announcement.ctaLabel}
              className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
            />
          )}
        </div>
        <div className="hidden @2xl:block">
          {announcement.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded to Vercel Blob, no next/image remote config
            <img
              src={announcement.imageUrl}
              alt=""
              className="mx-auto max-h-60 w-full rounded-xl object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-accent">
              <FunnelsLogoMark className="h-24 w-24 opacity-80" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** One entry of the "Novedades" grid. */
export function NewsCard({ item }: { item: AnnouncementView }) {
  return (
    <article className="fl-card fl-card-hover flex flex-col overflow-hidden">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded to Vercel Blob, no next/image remote config
        <img src={item.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {item.badge && (
          <span className="self-start rounded-full bg-accent-secondary/15 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-accent-secondary">
            {item.badge}
          </span>
        )}
        <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
        <p className="line-clamp-4 whitespace-pre-line text-xs text-ink-muted">{item.body}</p>
        {item.ctaUrl && item.ctaLabel && (
          <CtaLink
            href={item.ctaUrl}
            label={`${item.ctaLabel} →`}
            className="mt-auto pt-1 text-xs font-semibold text-accent hover:underline"
          />
        )}
      </div>
    </article>
  );
}
