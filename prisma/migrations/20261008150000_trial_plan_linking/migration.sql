ALTER TABLE "User" ADD COLUMN "mpPreapprovalId" TEXT;
ALTER TABLE "User" ADD COLUMN "trialCheckoutAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_mpPreapprovalId_key" ON "User"("mpPreapprovalId");

CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
