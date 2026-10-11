-- CreateTable
CREATE TABLE "CommentAutoReply" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "networks" TEXT[],
    "publicReplies" TEXT[],
    "privateMessage" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentAutoReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentAutoReplyLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "author" TEXT,
    "comment" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentAutoReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentAutoReply_businessId_idx" ON "CommentAutoReply"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentAutoReplyLog_businessId_commentId_key" ON "CommentAutoReplyLog"("businessId", "commentId");

-- CreateIndex
CREATE INDEX "CommentAutoReplyLog_businessId_createdAt_idx" ON "CommentAutoReplyLog"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommentAutoReply" ADD CONSTRAINT "CommentAutoReply_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
