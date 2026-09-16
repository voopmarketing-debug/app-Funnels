-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "cacheCreationInputTokens" INTEGER,
ADD COLUMN     "cacheReadInputTokens" INTEGER,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER;
