-- Client corrections 2026-10-05: Country, Travel Date and PAX shown and
-- filterable on Leads / Quotations / Bookings. Copied out of Lead.details
-- (new leads: src/lib/leads/list-facts.ts at intake).

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "countryId" TEXT,
ADD COLUMN     "paxCount" INTEGER,
ADD COLUMN     "travelDate" DATE;

-- CreateIndex
CREATE INDEX "Lead_countryId_idx" ON "Lead"("countryId");

-- CreateIndex
CREATE INDEX "Lead_travelDate_idx" ON "Lead"("travelDate");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing leads from their details (same rules as list-facts.ts).
UPDATE "Lead" SET "travelDate" = substring("details"->>'travelDate' from 1 for 10)::date
WHERE "details"->>'travelDate' ~ '^\d{4}-\d{2}-\d{2}';

UPDATE "Lead" SET "paxCount" = CASE
  WHEN jsonb_typeof("details"->'passengerIds') = 'array' AND jsonb_array_length("details"->'passengerIds') > 0 THEN jsonb_array_length("details"->'passengerIds')
  WHEN "details"->>'travelers' ~ '^\d+$' THEN ("details"->>'travelers')::int
  WHEN jsonb_typeof("details"->'applicants') = 'array' AND jsonb_array_length("details"->'applicants') > 0 THEN jsonb_array_length("details"->'applicants')
  WHEN jsonb_typeof("details"->'passengers') = 'array' AND jsonb_array_length("details"->'passengers') > 0 THEN jsonb_array_length("details"->'passengers')
  ELSE NULL
END;

UPDATE "Lead" l SET "countryId" = c."id"
FROM "Country" c
WHERE l."countryId" IS NULL AND l."details"->>'destinationCountry' = c."code";

UPDATE "Lead" l SET "countryId" = c."id"
FROM "Country" c
WHERE l."countryId" IS NULL AND l."details"->>'destinationCountryId' = c."id";
