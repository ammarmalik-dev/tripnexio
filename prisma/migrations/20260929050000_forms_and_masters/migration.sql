-- AlterTable
ALTER TABLE "Passenger" ADD COLUMN     "nationalityId" TEXT;

-- AlterTable
ALTER TABLE "DocumentRequirement" ADD COLUMN     "nationalityId" TEXT;

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN     "nationalityId" TEXT;

-- CreateTable
CREATE TABLE "VisaType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nationality" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nationality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisaType_active_idx" ON "VisaType"("active");

-- CreateIndex
CREATE INDEX "VisaType_countryId_idx" ON "VisaType"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Nationality_name_key" ON "Nationality"("name");

-- CreateIndex
CREATE INDEX "Nationality_active_idx" ON "Nationality"("active");

-- CreateIndex
CREATE INDEX "Nationality_countryId_idx" ON "Nationality"("countryId");

-- CreateIndex
CREATE INDEX "Passenger_nationalityId_idx" ON "Passenger"("nationalityId");

-- CreateIndex
CREATE INDEX "DocumentRequirement_nationalityId_idx" ON "DocumentRequirement"("nationalityId");

-- CreateIndex
CREATE INDEX "PricingRule_nationalityId_idx" ON "PricingRule"("nationalityId");

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Nationality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaType" ADD CONSTRAINT "VisaType_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nationality" ADD CONSTRAINT "Nationality_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Nationality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_nationalityId_fkey" FOREIGN KEY ("nationalityId") REFERENCES "Nationality"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- P06 data: one Nationality per existing Country (name = the country's name).
INSERT INTO "Nationality" ("id", "name", "countryId", "active", "createdAt", "updatedAt")
SELECT 'nat_' || c."id", c."name", c."id", c."active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Country" c
ON CONFLICT ("name") DO NOTHING;

-- Link existing free-text nationalities to the new master (case-insensitive).
-- Unmatched rows keep their text and still match by name at lookup time.
UPDATE "Passenger" p SET "nationalityId" = n."id"
FROM "Nationality" n
WHERE p."nationalityId" IS NULL AND p."nationality" IS NOT NULL AND lower(trim(p."nationality")) = lower(n."name");

UPDATE "PricingRule" r SET "nationalityId" = n."id"
FROM "Nationality" n
WHERE r."nationalityId" IS NULL AND r."nationality" IS NOT NULL AND lower(trim(r."nationality")) = lower(n."name");

UPDATE "DocumentRequirement" d SET "nationalityId" = n."id"
FROM "Nationality" n
WHERE d."nationalityId" IS NULL AND d."nationality" IS NOT NULL AND lower(trim(d."nationality")) = lower(n."name");

-- P06: post-payment document lists move from code into DocumentRequirement.
-- Return Ticket per RVT Page Content v3 §7; OTB keeps its current four.
INSERT INTO "DocumentRequirement" ("id", "serviceType", "documentName", "required", "active", "createdAt", "updatedAt")
SELECT v.id, v.service::"ServiceType", v.name, v.required, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('docreq_rt_passport', 'RETURN_TICKET', 'Passport copy', true),
  ('docreq_rt_return',   'RETURN_TICKET', 'Return ticket', false),
  ('docreq_rt_visa',     'RETURN_TICKET', 'Visa copy',     false),
  ('docreq_otb_passport','OTB',           'Passport copy', true),
  ('docreq_otb_visa',    'OTB',           'Visa copy',     true),
  ('docreq_otb_onward',  'OTB',           'Onward ticket', true),
  ('docreq_otb_return',  'OTB',           'Return ticket', true)
) AS v(id, service, name, required)
WHERE NOT EXISTS (
  SELECT 1 FROM "DocumentRequirement" d
  WHERE d."serviceType" = v.service::"ServiceType" AND lower(d."documentName") = lower(v.name)
    AND d."countryId" IS NULL AND d."nationality" IS NULL AND d."paxType" IS NULL
);
