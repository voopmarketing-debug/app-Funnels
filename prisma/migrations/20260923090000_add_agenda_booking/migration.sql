-- AlterTable
ALTER TABLE "Website" ADD COLUMN "pageType" TEXT NOT NULL DEFAULT 'landing';

-- CreateTable
CREATE TABLE "AgendaConfig" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "notificationEmail" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "availability" JSONB NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#1f6feb',

    CONSTRAINT "AgendaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgendaConfig_websiteId_key" ON "AgendaConfig"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_websiteId_startsAt_key" ON "Appointment"("websiteId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_websiteId_startsAt_idx" ON "Appointment"("websiteId", "startsAt");

-- AddForeignKey
ALTER TABLE "AgendaConfig" ADD CONSTRAINT "AgendaConfig_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
