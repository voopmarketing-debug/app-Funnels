-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "dayBeforeReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "appointmentDayBeforeFor" TIMESTAMP(3);
