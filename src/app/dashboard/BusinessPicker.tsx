"use client";

import { useRouter } from "next/navigation";

// Inicio summarizes one agent at a time — for an agency (or a client with
// several WhatsApp lines) this switches which one.
export function BusinessPicker({ currentId, businesses }: { currentId: string; businesses: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="fl-raised relative inline-flex w-full max-w-[18rem] items-center gap-2.5 rounded-xl py-2 pl-2.5 pr-9 sm:w-auto sm:min-w-[14rem]">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="7" width="16" height="12" rx="3.5" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3.5V7M9 12.5h.01M15 12.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Agente</span>
        <select
          value={currentId}
          onChange={(e) => router.push(`/dashboard?b=${e.target.value}`)}
          aria-label="Agente"
          className="block w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent text-sm font-semibold text-ink outline-none"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </span>
      <svg className="pointer-events-none absolute right-3 h-4 w-4 text-ink-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
