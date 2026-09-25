-- Add NewVisaCountryConfig.entryType (descriptive display text for the
-- New Visa product card's "Entry Type" row — see the model's own doc
-- comment). Added with a default so the existing UAE sample row backfills
-- cleanly; new rows must always supply a real value going forward (the
-- app-level validation schema requires it, same as visaCategory/duration).
ALTER TABLE "NewVisaCountryConfig" ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'SAMPLE — Single Entry / Multiple Entry';
ALTER TABLE "NewVisaCountryConfig" ALTER COLUMN "entryType" DROP DEFAULT;
