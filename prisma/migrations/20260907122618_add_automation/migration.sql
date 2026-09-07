
-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL,
    "summary" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationReminderLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRun_workflowKey_createdAt_idx" ON "AutomationRun"("workflowKey", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationReminderLog_event_entityType_entityId_sentAt_idx" ON "AutomationReminderLog"("event", "entityType", "entityId", "sentAt");

