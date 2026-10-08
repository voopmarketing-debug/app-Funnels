"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConversationStage } from "@/lib/actions";
import { isWonStageName } from "@/lib/sales";
import { SaleDialog } from "../../SaleDialog";

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
  // Moving a lead to a "Ganado"-type stage offers to register the sale.
  const [wonStage, setWonStage] = useState<string | null>(null);

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
      const stage = stages.find((s) => s.id === newStageId);
      if (stage && isWonStageName(stage.name)) setWonStage(stage.name);
    });
  }

  return (
    <>
      <select
        value={stageId}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="fl-mono max-w-[11rem] flex-none rounded-md border border-border bg-background px-2 py-1.5 text-[13px] uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
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
      <SaleDialog
        businessId={businessId}
        conversationId={conversationId}
        open={wonStage !== null}
        onClose={() => setWonStage(null)}
        reason={`Lo pasaste a "${wonStage ?? ""}". ¿Cuánto compró? Así queda en tus KPIs de ventas.`}
      />
    </>
  );
}
