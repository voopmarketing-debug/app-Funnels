-- AlterTable
ALTER TABLE "Business" ADD COLUMN "autoBookingLinkEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WebsiteLead" ADD COLUMN "bookingLinkSentAt" TIMESTAMP(3);
