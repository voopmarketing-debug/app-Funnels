-- Professionals a business can offer bookings with, each on their own
-- weekly schedule. Optional: an agenda with none behaves exactly as before.
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "agendaConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "availability" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Professional_agendaConfigId_idx" ON "Professional"("agendaConfigId");

ALTER TABLE "Professional" ADD CONSTRAINT "Professional_agendaConfigId_fkey"
    FOREIGN KEY ("agendaConfigId") REFERENCES "AgendaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Appointment gains an optional professionalId
ALTER TABLE "Appointment" ADD COLUMN "professionalId" TEXT;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Replaces the old (websiteId, startsAt) unique constraint from
-- 20260923090000_add_agenda_booking, which would otherwise block two
-- different professionals from holding the same clock time.
DROP INDEX "Appointment_websiteId_startsAt_key";
DROP INDEX "Appointment_websiteId_startsAt_idx";

-- Same double-booking guard as before, but now scoped per professional —
-- COALESCE(professionalId, '') treats every appointment with no
-- professional (the single-provider case) as one shared bucket, same as the
-- old constraint's behavior, while different professionals no longer
-- collide with each other. Prisma's schema language can't declare an
-- expression index, so this exists only here — see the comment on
-- Appointment in schema.prisma.
CREATE UNIQUE INDEX "Appointment_website_professional_startsAt_key"
    ON "Appointment" ("websiteId", (COALESCE("professionalId", '')), "startsAt");

CREATE INDEX "Appointment_websiteId_professionalId_startsAt_idx"
    ON "Appointment" ("websiteId", "professionalId", "startsAt");
