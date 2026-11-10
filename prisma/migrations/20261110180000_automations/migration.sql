-- Conversation flows (see src/lib/automations): the flow itself and each
-- conversation's run through it. Additive: new tables only.

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "triggers" JSONB NOT NULL DEFAULT '[]',
    "definition" JSONB NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "launches" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stepId" TEXT,
    "resumeAt" TIMESTAMP(3),
    "vars" JSONB NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_businessId_enabled_idx" ON "Automation"("businessId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRun_conversationId_status_idx" ON "AutomationRun"("conversationId", "status");

-- CreateIndex
CREATE INDEX "AutomationRun_status_resumeAt_idx" ON "AutomationRun"("status", "resumeAt");

-- CreateIndex
CREATE INDEX "AutomationRun_automationId_idx" ON "AutomationRun"("automationId");

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
