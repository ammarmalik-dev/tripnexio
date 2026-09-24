-- Step 42 (Admin FINAL handover §6): ServiceTimelineConfig -- one row per
-- ServiceType, generic SLA durations not already covered by OtbRuleConfig/
-- ReturnTicketRuleConfig (both kept separate -- see the model's own schema
-- doc comment for why). Every field starts NULL (hard rule #1 -- no
-- invented SLA numbers); seed.ts pre-creates one empty row per service.

-- CreateTable
CREATE TABLE "ServiceTimelineConfig" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "documentVerificationHours" INTEGER,
    "expectedCompletionHours" INTEGER,
    "quotationResponseMinutes" INTEGER,
    "paymentDeadlineHours" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTimelineConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTimelineConfig_serviceType_key" ON "ServiceTimelineConfig"("serviceType");

-- CreateIndex
CREATE INDEX "ServiceTimelineConfig_active_idx" ON "ServiceTimelineConfig"("active");
