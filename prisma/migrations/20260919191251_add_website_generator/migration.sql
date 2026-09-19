-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "model" TEXT,
    "customDomain" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Website_businessId_key" ON "Website"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Website_slug_key" ON "Website"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Website_customDomain_key" ON "Website"("customDomain");

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
