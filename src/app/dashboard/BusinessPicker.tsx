"use client";

import { useRouter } from "next/navigation";

// Inicio summarizes one agent at a time — for an agency (or a client with
// several WhatsApp lines) this switches which one.
export function BusinessPicker({ currentId, businesses }: { currentId: string; businesses: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted">
      Agente
      <select
        value={currentId}
        onChange={(e) => router.push(`/dashboard?b=${e.target.value}`)}
        className="max-w-[14rem] rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-ink outline-none focus:border-accent"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
