"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUnreadNotificationCount } from "@/lib/actions";

const POLL_INTERVAL_MS = 5000;

/**
 * Invisible — plays a short beep and refreshes the page whenever a new
 * notification arrives (a customer message, an appointment, a metric
 * alert), so the person doesn't have to be staring at the bell to notice
 * someone wrote in. Generates the beep with the Web Audio API instead of
 * shipping an audio file. Browsers block audio until the user has
 * interacted with the page at least once — that's expected here, the first
 * click anywhere in the dashboard unlocks it for the rest of the session.
 */
export function NotificationSoundPoller() {
  const router = useRouter();
  const lastCountRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    function playBeep() {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        const now = ctx.currentTime;
        // Two-tone "ping" — short, friendly, distinct from a generic beep.
        [880, 1175].forEach((freq, i) => {
          const start = now + i * 0.12;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.2, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.2);
        });
      } catch {
        // Autoplay blocked or unsupported — silently skip, the visual bell
        // badge (updated via router.refresh below) still does its job.
      }
    }

    async function poll() {
      let count: number;
      try {
        count = await getUnreadNotificationCount();
      } catch {
        return; // transient error — next tick tries again
      }
      if (cancelled) return;

      if (lastCountRef.current === null) {
        // First tick just establishes the baseline — no beep on page load.
        lastCountRef.current = count;
        return;
      }
      if (count > lastCountRef.current) {
        playBeep();
        router.refresh();
      }
      lastCountRef.current = count;
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
