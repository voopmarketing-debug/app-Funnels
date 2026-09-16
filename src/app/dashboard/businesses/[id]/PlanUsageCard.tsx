"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessPlan } from "@/lib/actions";
import { PLAN_TIERS, PLAN_LABELS, type PlanUsageStatus } from "@/lib/plans";
import type { PlanTier } from "@prisma/client";
import { RingStat } from "@/components/RingStat";

const STATUS_STYLES: Record<PlanUsageStatus, { bar: string; label: string; text: string }> = {
  good: { bar: "#0ca30c", label: "Bien", text: "#0ca30c" },
  warning: { bar: "#fab219", label: "Cerca del límite", text: "#fab219" },
  critical: { bar: "#d03b3b", label: "Límite superado", text: "#d03b3b" },
  unlimited: { bar: "#b5ff2b", label: "Ilimitado", text: "#8a8a86" },
};

export function PlanUsageCard({
  businessId,
  planTier,
  used,
  limit,
  status,
  canEditPlan,
}: {
  businessId: string;
  planTier: PlanTier;
  used: number;
  limit: number | null;
  status: PlanUsageStatus;
  canEditPlan: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<PlanTier | null>(null);

  const style = STATUS_STYLES[status];
  const pct = limit === null ? 100 : Math.min(100, (used / limit) * 100);

  function handlePlanChange(newPlan: PlanTier) {
    setPendingPlan(newPlan);
    startTransition(async () => {
      await updateBusinessPlan(businessId, newPlan);
      router.refresh();
    });
  }

  return (
    <div className="fl-card-hero flex flex-wrap items-center gap-5 p-4">
      <RingStat percent={pct} gradientId={`plan-usage-${businessId}`} gradientFrom={style.bar} gradientTo={style.bar}>
        <span className="fl-mono text-sm font-semibold text-ink">{limit === null ? "∞" : `${Math.round(pct)}%`}</span>
      </RingStat>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-ink">Plan {PLAN_LABELS[planTier]}</p>
            {status !== "unlimited" && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: style.text }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.bar }} />
                {style.label}
              </span>
            )}
          </div>

          {canEditPlan && (
            <select
              value={pendingPlan ?? planTier}
              disabled={isPending}
              onChange={(e) => handlePlanChange(e.target.value as PlanTier)}
              className="fl-mono rounded-md border border-border bg-background px-2 py-1 text-xs uppercase tracking-wide text-ink-muted outline-none focus:border-accent"
            >
              {PLAN_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {PLAN_LABELS[tier]}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="fl-mono text-xs text-ink-muted">
          {used} / {limit === null ? "∞" : limit} contactos este mes
        </p>
      </div>
    </div>
  );
}
