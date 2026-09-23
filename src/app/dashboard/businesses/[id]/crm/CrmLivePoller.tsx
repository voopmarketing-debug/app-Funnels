"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getConversationActivitySignature } from "@/lib/actions";

const POLL_INTERVAL_MS = 4000;

/**
 * Invisible — just keeps the CRM (chat list, open thread, board) in sync
 * with new inbound WhatsApp messages without a manual page reload. Polls a
 * cheap signature (message count + latest timestamp) rather than the real
 * data, and only triggers a real refetch (router.refresh, re-runs this
 * route's Server Components) when that signature actually changes.
 */
export function CrmLivePoller({ businessId }: { businessId: string }) {
  const router = useRouter();
  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      let signature: string;
      try {
        signature = await getConversationActivitySignature(businessId);
      } catch {
        return; // transient error — next tick tries again
      }
      if (cancelled) return;

      if (lastSignatureRef.current === null) {
        // First tick just establishes the baseline — nothing changed yet.
        lastSignatureRef.current = signature;
        return;
      }
      if (signature !== lastSignatureRef.current) {
        lastSignatureRef.current = signature;
        router.refresh();
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [businessId, router]);

  return null;
}
