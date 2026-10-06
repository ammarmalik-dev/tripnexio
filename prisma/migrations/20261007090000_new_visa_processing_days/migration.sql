-- Client corrections 2026-10-05: New Visa processing time (working days) per processing type,
-- used for the Expected Approval Date. Left empty: Admin sets the real values.

-- AlterTable
ALTER TABLE "ServiceTimelineConfig" ADD COLUMN     "processingDaysExpress" INTEGER,
ADD COLUMN     "processingDaysNormal" INTEGER;

