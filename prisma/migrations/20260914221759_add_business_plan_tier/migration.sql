-- Plan tier per business, for the monthly active-contacts limit shown on
-- the dashboard (see src/lib/plans.ts). Informational only for now — no
-- billing integration enforces it yet.
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'SCALE');

ALTER TABLE "Business" ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'STARTER';
