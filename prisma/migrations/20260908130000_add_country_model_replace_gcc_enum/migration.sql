-- Step 6.1 (client-locked-spec DEVELOPMENT_ROADMAP.md): replace the fixed
-- GccCountry enum with an admin-manageable Country table, so a new country
-- can be added/edited/disabled with zero code deployments. Backfills the 8
-- real locked country values (matching the old enum exactly) as historical
-- baseline rows -- any future country beyond these goes through the new
-- Admin API, not a migration.

-- 1. Create Country table first so the backfill below can reference it.
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");
CREATE INDEX "Country_active_idx" ON "Country"("active");

-- 2. Seed the real locked country rows (not sample data -- this is the
-- actual India/GCC market scope from CLAUDE.md's own "Scope (locked)"
-- section, same identifiers the GccCountry enum used).
INSERT INTO "Country" ("id", "code", "name", "active", "displayOrder", "createdAt", "updatedAt") VALUES
  ('cty_india',        'INDIA',        'India',                true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_uae',          'UAE',          'United Arab Emirates', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_saudi_arabia', 'SAUDI_ARABIA', 'Saudi Arabia',         true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_bahrain',      'BAHRAIN',      'Bahrain',              true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_kuwait',       'KUWAIT',       'Kuwait',               true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_oman',         'OMAN',         'Oman',                 true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_qatar',        'QATAR',        'Qatar',                true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cty_other',        'OTHER',        'Other',                true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Add countryId nullable first so existing Airport/Border rows can be
-- backfilled before the NOT NULL constraint is enforced.
ALTER TABLE "Airport" ADD COLUMN "countryId" TEXT;
ALTER TABLE "Border" ADD COLUMN "countryId" TEXT;

-- 4. Backfill from the old enum columns (text-cast comparison against the
-- new Country.code, which uses the exact same identifiers).
UPDATE "Airport" a SET "countryId" = c."id" FROM "Country" c WHERE c."code" = a."gccClassification"::text;
UPDATE "Border" b SET "countryId" = c."id" FROM "Country" c WHERE c."code" = b."side"::text;

-- 5. Now enforce NOT NULL.
ALTER TABLE "Airport" ALTER COLUMN "countryId" SET NOT NULL;
ALTER TABLE "Border" ALTER COLUMN "countryId" SET NOT NULL;

-- 6. Drop the old enum-backed columns/indexes/type.
DROP INDEX "Airport_gccClassification_idx";
DROP INDEX "Border_side_idx";
ALTER TABLE "Airport" DROP COLUMN "gccClassification";
ALTER TABLE "Border" DROP COLUMN "side";
DROP TYPE "GccCountry";

-- 7. New indexes + foreign keys for the replacement column.
CREATE INDEX "Airport_countryId_idx" ON "Airport"("countryId");
CREATE INDEX "Border_countryId_idx" ON "Border"("countryId");

ALTER TABLE "Airport" ADD CONSTRAINT "Airport_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Border" ADD CONSTRAINT "Border_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
