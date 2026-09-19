/*
  Warnings:

  - You are about to drop the column `html` on the `Website` table. All the data in the column will be lost.
  - Added the required column `content` to the `Website` table without a default value. This is not possible if the table is not empty.
  - Added the required column `whatsappNumber` to the `Website` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Website" DROP COLUMN "html",
ADD COLUMN     "content" JSONB NOT NULL,
ADD COLUMN     "whatsappNumber" TEXT NOT NULL;
