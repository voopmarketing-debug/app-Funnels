-- AlterTable
ALTER TABLE "AIAgent" ADD COLUMN     "replyLength" TEXT NOT NULL DEFAULT 'breve',
ADD COLUMN     "tone" TEXT NOT NULL DEFAULT 'cercano';
