-- Background context for the AI agent's prompt (city/country/social media).
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "country" TEXT;
ALTER TABLE "User" ADD COLUMN "socialMedia" TEXT;
