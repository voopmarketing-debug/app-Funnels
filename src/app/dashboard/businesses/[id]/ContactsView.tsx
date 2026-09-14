"use client";

import { useState } from "react";
import { CrmBoard, type CrmStage, type CrmConversation } from "./CrmBoard";
import { ContactsTable } from "./ContactsTable";

export function ContactsView({
  businessId,
  stages,
  conversations,
}: {
  businessId: string;
  stages: CrmStage[];
  conversations: CrmConversation[];
}) {
  const [view, setView] = useState<"board" | "list">("board");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("board")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            view === "board" ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          Tablero
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            view === "list" ? "bg-accent text-accent-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          Lista
        </button>
      </div>

      {view === "board" ? (
        <CrmBoard businessId={businessId} stages={stages} conversations={conversations} />
      ) : (
        <ContactsTable businessId={businessId} stages={stages} conversations={conversations} />
      )}
    </div>
  );
}
