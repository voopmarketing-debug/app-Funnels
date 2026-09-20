"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";

export function StageSelector({
  businessId,
  conversationId,
  stageId,
  stages,
}: {
  businessId: string;
  conversationId: string;
  stageId: string;
  stages: { id: string; name: string; pipelineName?: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Picking a stage from a different embudo (funnel) than the one this
  // conversation is currently in is exactly how a team member "claims" a
  // lead into their own funnel — see Pipeline in schema.prisma. Grouped by
  // embudo so that's clear, and so same-named stages in different embudos
  // (e.g. both have "Nuevo") don't look identical in the dropdown. Only
  // meaningful when the caller actually passed pipelineName for every stage
  // (i.e. showing stages across the whole business, not just one embudo).
  const allHavePipelineName = stages.every((s) => !!s.pipelineName);
  const pipelineNames = allHavePipelineName ? Array.from(new Set(stages.map((s) => s.pipelineName as string))) : [];
  const groupByPipeline = pipelineNames.length > 1;

  function handleChange(newStageId: string) {
    startTransition(async () => {
      await updateConversationStage(businessId, conversationId, newStageId);
      router.refresh();
    });
  }

  return (
    <select
      value={stageId}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="fl-mono rounded-md border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
    >
      {groupByPipeline
        ? pipelineNames.map((pipelineName) => (
            <optgroup key={pipelineName} label={pipelineName}>
              {stages
                .filter((s) => s.pipelineName === pipelineName)
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
            </optgroup>
          ))
        : stages.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
    </select>
  );
}
