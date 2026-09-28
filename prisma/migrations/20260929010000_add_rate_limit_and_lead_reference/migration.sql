-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "reference" TEXT;

-- Backfill: same formula as formatLeadReference() in src/lib/leads/reference.ts
-- (service prefix + "-" + last 6 characters of the id, uppercased). Additive only.
UPDATE "Lead" SET "reference" = (
  CASE "serviceType"
    WHEN 'NEW_VISA' THEN 'NV'
    WHEN 'VISA_EXTENSION' THEN 'VE'
    WHEN 'VISA_CHANGE' THEN 'VC'
    WHEN 'FLIGHT_SPECIAL_FARE' THEN 'FF'
    WHEN 'RETURN_TICKET' THEN 'RT'
    WHEN 'OTB' THEN 'OTB'
    WHEN 'OTHER' THEN 'OS'
  END
) || '-' || UPPER(RIGHT("id", 6))
WHERE "reference" IS NULL;

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "Lead_reference_idx" ON "Lead"("reference");
