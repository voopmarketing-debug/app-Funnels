-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userAccessToken" TEXT,
    "userTokenExpiresAt" TIMESTAMP(3),
    "fbPageId" TEXT,
    "fbPageName" TEXT,
    "pageAccessToken" TEXT,
    "igUserId" TEXT,
    "igUsername" TEXT,
    "adAccountId" TEXT,
    "adAccountName" TEXT,
    "adCurrency" TEXT,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMetricCache" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMetricCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialFollowerSnapshot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followers" INTEGER NOT NULL,

    CONSTRAINT "SocialFollowerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_businessId_key" ON "SocialConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMetricCache_businessId_key_key" ON "SocialMetricCache"("businessId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SocialFollowerSnapshot_businessId_network_date_key" ON "SocialFollowerSnapshot"("businessId", "network", "date");

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
