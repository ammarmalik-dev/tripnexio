-- Client corrections 2026-10-05: holidays for every enabled country, not just
-- India and the UAE. A holiday now points at a Country master row; the old
-- INDIA/UAE value stays for existing rows and is still read by the working
-- calendar (src/lib/calendar/get-working-calendar.ts).

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "countryId" TEXT,
ALTER COLUMN "country" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Holiday_countryId_active_idx" ON "Holiday"("countryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_countryId_key" ON "Holiday"("date", "countryId");

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link existing India / UAE holidays to their Country rows (matched by ISO code or name).
UPDATE "Holiday" h SET "countryId" = c."id"
FROM "Country" c
WHERE h."countryId" IS NULL AND h."country" = 'INDIA'
  AND (upper(c."code") IN ('IN', 'IND') OR lower(c."name") = 'india');

UPDATE "Holiday" h SET "countryId" = c."id"
FROM "Country" c
WHERE h."countryId" IS NULL AND h."country" = 'UAE'
  AND (upper(c."code") IN ('AE', 'ARE', 'UAE') OR lower(c."name") IN ('united arab emirates', 'uae'));
