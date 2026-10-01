"use client";

import { useSyncExternalStore } from "react";
import type { CrmConversation } from "../CrmBoard";

const noopSubscribe = () => () => {};

/**
 * Kommo/WhatsApp-style stamp: time today, "Ayer", weekday this week, else
 * the date. Browser-only (see ClientDate) so the server and the browser
 * never disagree about "today" or ICU spacing during hydration.
 */
export function useListTimeFormatter() {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (iso: string): string => {
    if (!isClient) return "";
    const date = new Date(iso);
    const tz = "America/Bogota";
    const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
    const now = new Date();
    if (dayKey(date) === dayKey(now)) {
      return new Intl.DateTimeFormat("es-CO", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
    }
    if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) return "Ayer";
    if (Math.abs(now.getTime() - date.getTime()) < 6 * 86_400_000) {
      return new Intl.DateTimeFormat("es-CO", { timeZone: tz, weekday: "short" }).format(date);
    }
    return new Intl.DateTimeFormat("es-CO", { timeZone: tz, day: "numeric", month: "short" }).format(date);
  };
}

/** "IA: Claro, te cuento…" / "📷 Foto" — the one-line preview of a chat's last message. */
export function previewText(c: CrmConversation): string {
  const last = c.lastMessage;
  if (!last) return "";
  if (last.content.startsWith("[ERROR INTERNO")) return "⚠ La IA no pudo responder";
  const isPlaceholder = /^\[.*\]$/.test(last.content.trim());
  let body = last.content;
  if (last.mediaType && (isPlaceholder || !body.trim())) {
    body = { image: "📷 Foto", audio: "🎤 Nota de voz", video: "🎥 Video", document: "📄 Documento" }[last.mediaType] ?? "📎 Archivo";
  }
  const prefix = last.from === "ai" ? "IA: " : last.from === "human" ? "Tú: " : "";
  return prefix + body.replace(/\s+/g, " ").trim();
}
