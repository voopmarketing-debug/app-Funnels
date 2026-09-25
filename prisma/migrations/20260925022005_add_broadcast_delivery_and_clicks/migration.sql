-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ctaUrl" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "broadcastId" TEXT,
ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "deliveryStatusAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BroadcastClick" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastClick_broadcastId_idx" ON "BroadcastClick"("broadcastId");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastClick_broadcastId_conversationId_key" ON "BroadcastClick"("broadcastId", "conversationId");

-- CreateIndex
CREATE INDEX "Message_whatsappMsgId_idx" ON "Message"("whatsappMsgId");

-- CreateIndex
CREATE INDEX "Message_broadcastId_idx" ON "Message"("broadcastId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastClick" ADD CONSTRAINT "BroadcastClick_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastClick" ADD CONSTRAINT "BroadcastClick_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
