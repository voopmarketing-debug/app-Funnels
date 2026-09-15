-- Password reset flow: a hashed, single-use, time-limited token per user.
ALTER TABLE "User" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");
