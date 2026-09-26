-- CreateIndex
CREATE INDEX "Conversation_businessId_lastMessageAt_idx" ON "Conversation"("businessId", "lastMessageAt");
