-- Agenda pages: look, texts, address, logo, services, optional note; professional photo; what each booking was.
ALTER TABLE "AgendaConfig" ADD COLUMN "style" TEXT NOT NULL DEFAULT 'clasico',
ADD COLUMN "title" TEXT,
ADD COLUMN "subtitle" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "mapUrl" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "askNote" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "services" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Professional" ADD COLUMN "photoUrl" TEXT;

ALTER TABLE "Appointment" ADD COLUMN "service" TEXT,
ADD COLUMN "note" TEXT,
ADD COLUMN "durationMinutes" INTEGER;
