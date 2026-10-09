-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "appointmentReminderFor" TIMESTAMP(3);

-- Reminder sweep: upcoming appointments on the CRM ficha.
CREATE INDEX "Conversation_appointmentAt_idx" ON "Conversation"("appointmentAt");
