-- Client doc 2026-10-15 — fully editable New Visa country pages (eTA / arrival card wording too).
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "serviceName" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "applyLabel" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "introEyebrow" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "selectorEyebrow" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "selectorHeading" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "childrenHeading" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "stayLabel" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "validityLabel" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "processEyebrow" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "processHeading" TEXT;
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "howItWorksSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NewVisaCountryPage" ADD COLUMN "statusSampleText" TEXT;
