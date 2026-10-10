"use client";

import { useRouter } from "next/navigation";

// Lets someone with more than one agent (a client on Starter/Pro running
// several lines, or the agency) jump straight to another agent's KPIs/CRM
// without going back through "Agentes de IA" first. `section` is whatever
// sub-path follows the business id — "analytics" or "crm" — so switching
// stays on the same kind of page.
export function AgentSwitcher({
  businesses,
  currentId,
  section,
}: {
  businesses: { id: string; name: string }[];
  currentId: string;
  section: "analytics" | "crm";
}) {
  const router = useRouter();

  if (businesses.length <= 1) return null;

  return (
    <label className="fl-raised relative inline-flex w-full max-w-[17rem] items-center gap-2 rounded-xl py-2 pl-2 pr-9">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="7" width="16" height="12" rx="3.5" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3.5V7M9 12.5h.01M15 12.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="sr-only">Agente</span>
      <select
        value={currentId}
        onChange={(e) => router.push(`/dashboard/businesses/${e.target.value}/${section}`)}
        className="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent text-sm font-semibold text-ink outline-none"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 h-4 w-4 text-ink-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
