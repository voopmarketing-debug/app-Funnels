-- CreateTable
CREATE TABLE "WebsiteEvent" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteEvent_websiteId_type_createdAt_idx" ON "WebsiteEvent"("websiteId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "WebsiteEvent" ADD CONSTRAINT "WebsiteEvent_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
