-- AlterTable
ALTER TABLE "Business" ADD COLUMN "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN "webhookError" TEXT,
ADD COLUMN "webhookErrorAt" TIMESTAMP(3),
ADD COLUMN "whatsappHealthOk" BOOLEAN,
ADD COLUMN "whatsappHealthMessage" TEXT,
ADD COLUMN "whatsappHealthCheckedAt" TIMESTAMP(3);
