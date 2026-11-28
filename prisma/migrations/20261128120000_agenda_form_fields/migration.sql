-- Agenda: the booking form's fields are editable, and each booking keeps the answers to the extra ones.
ALTER TABLE "AgendaConfig" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Appointment" ADD COLUMN "answers" JSONB;
