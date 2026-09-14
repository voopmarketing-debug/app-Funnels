-- Stores the latest AI-generated sales coaching report per business (see
-- src/lib/diagnosis.ts). Regenerated on demand from the dashboard, not on a
-- schedule, so both columns start empty until an owner clicks "Generar".
ALTER TABLE "AIAgent" ADD COLUMN "diagnosisReport" JSONB;
ALTER TABLE "AIAgent" ADD COLUMN "diagnosisGeneratedAt" TIMESTAMP(3);
