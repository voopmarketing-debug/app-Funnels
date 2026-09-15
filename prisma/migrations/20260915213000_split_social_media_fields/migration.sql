-- One field per social network instead of a single free-text "socialMedia".
ALTER TABLE "User" DROP COLUMN "socialMedia";
ALTER TABLE "User" ADD COLUMN "facebook" TEXT;
ALTER TABLE "User" ADD COLUMN "instagram" TEXT;
ALTER TABLE "User" ADD COLUMN "tiktok" TEXT;
ALTER TABLE "User" ADD COLUMN "linkedin" TEXT;
