-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "mediaFilename" TEXT,
ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "mediaUrl" TEXT;

-- CreateTable
CREATE TABLE "AgentMedia" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "filename" TEXT,
    "label" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentMedia_businessId_idx" ON "AgentMedia"("businessId");

-- AddForeignKey
ALTER TABLE "AgentMedia" ADD CONSTRAINT "AgentMedia_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
