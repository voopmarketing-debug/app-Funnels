"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { stageStyle } from "@/lib/crmStages";
import { contactInitial, contactLabel } from "@/lib/contactDisplay";
import type { CrmStage, CrmConversation } from "../CrmBoard";
import { previewText, useListTimeFormatter } from "./crmDisplay";

type Filter = "all" | "unread" | "pending";

const FILTERS: { id: Filter; label: string; hint: string }[] = [
  { id: "all", label: "Todas", hint: "Todas las conversaciones" },
  { id: "unread", label: "No leídas", hint: "Con mensajes que nadie ha abierto" },
  { id: "pending", label: "Sin respuesta", hint: "El último mensaje es del cliente" },
];

export function ConversationList({
  stages,
  conversations,
  selectedConversationId,
}: {
  stages: CrmStage[];
  conversations: CrmConversation[];
  selectedConversationId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const formatTime = useListTimeFormatter();
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => c.unreadCount > 0).length,
      pending: conversations.filter((c) => c.lastMessage?.from === "customer").length,
    }),
    [conversations],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return conversations.filter((c) => {
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (filter === "pending" && c.lastMessage?.from !== "customer") return false;
      if (!q) return true;
      return (
        (c.customerName ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && c.customerPhone.includes(digits)) ||
        (c.lastMessage?.content ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border p-2.5">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-accent/60">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 flex-none text-ink-faint" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversación"
            aria-label="Buscar conversaciones"
            className="h-9 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint md:text-sm"
          />
        </label>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                title={f.hint}
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={`flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-muted hover:text-ink"
                }`}
              >
                {f.label}
                {f.id !== "all" && counts[f.id] > 0 && (
                  <span className={`fl-mono text-[12px] ${active ? "opacity-80" : "text-ink-faint"}`}>{counts[f.id]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 && <p className="p-4 text-center text-xs text-ink-muted">Aún no hay conversaciones.</p>}
        {conversations.length > 0 && visible.length === 0 && (
          <p className="p-4 text-center text-xs text-ink-muted">Ninguna conversación coincide.</p>
        )}
        {visible.map((c) => {
          const stage = stageById.get(c.stageId);
          const style = stage ? stageStyle(stage.position) : null;
          const isActive = c.id === selectedConversationId;
          const isUnread = c.unreadCount > 0;
          const preview = previewText(c);

          return (
            <Link
              key={c.id}
              href={`?tab=chat&conv=${c.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`relative flex gap-3 border-b border-border/70 px-3 py-2.5 transition ${
                isActive ? "bg-accent/10" : "hover:bg-surface-2"
              }`}
            >
              {isActive && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
              <div className="fl-mono mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-bold text-ink-muted">
                {contactInitial(c.customerName, c.customerPhone).slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm ${isUnread ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                    {contactLabel(c.customerName, c.customerPhone)}
                  </p>
                  <span className={`flex-none text-[13px] ${isUnread ? "font-semibold text-accent" : "text-ink-faint"}`}>
                    {formatTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className={`line-clamp-1 min-w-0 flex-1 break-all text-xs ${isUnread ? "text-ink" : "text-ink-muted"}`}>
                    {preview || "Sin mensajes"}
                  </p>
                  {isUnread && (
                    <span className="fl-mono flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-accent px-1 text-[12px] font-bold text-accent-ink">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </div>
                {stage && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-ink-faint">
                    {style && <span className={`h-1.5 w-1.5 flex-none rounded-full ${style.dot}`} />}
                    <span className="truncate">{stage.name}</span>
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
