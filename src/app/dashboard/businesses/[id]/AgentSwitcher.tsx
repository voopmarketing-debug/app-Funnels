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
    <select
      value={currentId}
      onChange={(e) => router.push(`/dashboard/businesses/${e.target.value}/${section}`)}
      className="fl-mono w-full max-w-[14rem] rounded-md border border-border bg-surface px-2 py-1.5 text-xs uppercase tracking-wide text-ink outline-none focus:border-accent"
    >
      {businesses.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
