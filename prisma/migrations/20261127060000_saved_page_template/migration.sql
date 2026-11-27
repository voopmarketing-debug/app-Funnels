-- CreateTable
CREATE TABLE "SavedPageTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPageTemplate_businessId_idx" ON "SavedPageTemplate"("businessId");

-- AddForeignKey
ALTER TABLE "SavedPageTemplate" ADD CONSTRAINT "SavedPageTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
