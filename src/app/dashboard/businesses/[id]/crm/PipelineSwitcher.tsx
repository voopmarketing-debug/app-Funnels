"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Only rendered when a business has more than one embudo (funnel) — most
// businesses have just the one default, and showing a single-option
// dropdown would only add noise.
export function PipelineSwitcher({
  pipelines,
  selectedPipelineId,
}: {
  pipelines: { id: string; name: string }[];
  selectedPipelineId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      value={selectedPipelineId}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pipeline", e.target.value);
        params.delete("conv");
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent"
      title="Cambiar de embudo"
    >
      {pipelines.map((p) => (
        <option key={p.id} value={p.id}>
          🔀 {p.name}
        </option>
      ))}
    </select>
  );
}
