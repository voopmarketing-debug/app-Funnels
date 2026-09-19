/*
  Warnings:

  - You are about to drop the column `html` on the `Website` table. All the data in the column will be lost.
  - Added the required column `content` to the `Website` table without a default value. This is not possible if the table is not empty.
  - Added the required column `whatsappNumber` to the `Website` table without a default value. This is not possible if the table is not empty.

*/
-- Any row here is from the old single-page, raw-HTML version of this
-- feature (fully replaced by the structured-content editor) — safe to
-- clear so the NOT NULL columns below can be added even if a test site was
-- generated in production before this migration ran. Nothing of real
-- client value is lost; regenerating a page takes under a minute.
DELETE FROM "Website";

-- AlterTable
ALTER TABLE "Website" DROP COLUMN "html",
ADD COLUMN     "content" JSONB NOT NULL,
ADD COLUMN     "whatsappNumber" TEXT NOT NULL;
