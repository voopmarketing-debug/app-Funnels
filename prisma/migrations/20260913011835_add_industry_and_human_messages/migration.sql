-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "industry" TEXT NOT NULL DEFAULT 'otro';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sentByHuman" BOOLEAN NOT NULL DEFAULT false;
