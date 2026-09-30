-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "replyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReplyAttemptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "lastReplySweepAt" TIMESTAMP(3);
