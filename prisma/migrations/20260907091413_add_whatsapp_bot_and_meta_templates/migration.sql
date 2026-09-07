
-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "NotificationTemplate" ADD COLUMN     "metaTemplateLanguage" TEXT,
ADD COLUMN     "metaTemplateName" TEXT;

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "customerName" TEXT,
    "state" TEXT NOT NULL DEFAULT 'GREETING',
    "serviceType" "ServiceType",
    "collectedFields" JSONB NOT NULL DEFAULT '{}',
    "leadId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_waId_key" ON "WhatsAppConversation"("waId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_state_idx" ON "WhatsAppConversation"("state");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_leadId_idx" ON "WhatsAppConversation"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_waId_idx" ON "WhatsAppMessageLog"("waId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_createdAt_idx" ON "WhatsAppMessageLog"("createdAt");

