-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "appointmentAt" TIMESTAMP(3),
ADD COLUMN     "appointmentNote" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mediaFilename" TEXT,
ADD COLUMN     "mediaMimeType" TEXT,
ADD COLUMN     "mediaSizeBytes" INTEGER,
ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "mediaUrl" TEXT;

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stageId" TEXT,
    "message" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "totalRecipients" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "resultLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broadcast_businessId_createdAt_idx" ON "Broadcast"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
