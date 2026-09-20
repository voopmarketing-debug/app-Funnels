-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_businessId_position_key" ON "Pipeline"("businessId", "position");

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing business gets one default pipeline, so its
-- existing stages have somewhere to attach to below.
INSERT INTO "Pipeline" ("id", "businessId", "name", "position", "isDefault", "createdAt")
SELECT
  substr(md5(random()::text || clock_timestamp()::text || "Business"."id"), 1, 24),
  "Business"."id",
  'Embudo principal',
  0,
  true,
  now()
FROM "Business";

-- AlterTable
ALTER TABLE "PipelineStage" ADD COLUMN "pipelineId" TEXT;

-- Backfill: every existing stage moves into its business's new default pipeline.
UPDATE "PipelineStage"
SET "pipelineId" = "Pipeline"."id"
FROM "Pipeline"
WHERE "Pipeline"."businessId" = "PipelineStage"."businessId" AND "Pipeline"."isDefault" = true;

ALTER TABLE "PipelineStage" ALTER COLUMN "pipelineId" SET NOT NULL;

-- DropIndex
DROP INDEX "PipelineStage_businessId_position_key";

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_position_key" ON "PipelineStage"("pipelineId", "position");

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
