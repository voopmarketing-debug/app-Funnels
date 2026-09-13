-- Replace the fixed ConversationStage enum with a per-business, fully
-- customizable pipeline (add/rename/delete/reorder stages independently
-- per business).

-- 1. New table.
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PipelineStage_businessId_position_key" ON "PipelineStage"("businessId", "position");

ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Seed the same 5 default stages for every existing business.
INSERT INTO "PipelineStage" ("id", "businessId", "name", "position")
SELECT gen_random_uuid()::text, b."id", s.name, s.position
FROM "Business" b
CROSS JOIN (VALUES
    ('Nuevo', 0),
    ('En conversación', 1),
    ('Interesado', 2),
    ('Ganado', 3),
    ('Perdido', 4)
) AS s(name, position);

-- 3. Add the new FK column on Conversation and backfill it from the old enum.
ALTER TABLE "Conversation" ADD COLUMN "stageId" TEXT;

UPDATE "Conversation" c
SET "stageId" = ps."id"
FROM "PipelineStage" ps
WHERE ps."businessId" = c."businessId"
  AND ps."name" = CASE c."stage"
      WHEN 'NUEVO' THEN 'Nuevo'
      WHEN 'EN_CONVERSACION' THEN 'En conversación'
      WHEN 'INTERESADO' THEN 'Interesado'
      WHEN 'GANADO' THEN 'Ganado'
      WHEN 'PERDIDO' THEN 'Perdido'
  END;

ALTER TABLE "Conversation" ALTER COLUMN "stageId" SET NOT NULL;

CREATE INDEX "Conversation_stageId_idx" ON "Conversation"("stageId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Drop the old enum column and type.
ALTER TABLE "Conversation" DROP COLUMN "stage";
DROP TYPE "ConversationStage";
