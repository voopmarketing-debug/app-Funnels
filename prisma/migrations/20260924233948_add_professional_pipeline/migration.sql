-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "pipelineId" TEXT;

-- CreateIndex
CREATE INDEX "Professional_pipelineId_idx" ON "Professional"("pipelineId");

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
