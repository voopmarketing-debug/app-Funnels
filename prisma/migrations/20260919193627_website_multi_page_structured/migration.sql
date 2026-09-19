-- DropIndex
DROP INDEX "Website_businessId_key";

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "purpose" TEXT;

-- CreateIndex
CREATE INDEX "Website_businessId_idx" ON "Website"("businessId");
