-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "lastReadAt" TIMESTAMP(3);

-- Mark every existing conversation as caught-up as of this deploy, so the
-- new unread badge doesn't retroactively flag the entire chat history as
-- unread — only messages arriving after this point (or before the next
-- time someone opens the chat) will count.
UPDATE "Conversation" SET "lastReadAt" = CURRENT_TIMESTAMP;
