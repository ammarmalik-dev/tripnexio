-- Client doc 16 Nov (K8): Visa Entry Type master. A New Visa product's entryKind becomes the master's code (text),
-- converted in place so every existing product keeps its SINGLE / MULTIPLE value (no drop / re-add of the column).

CREATE TABLE "VisaEntryType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaEntryType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisaEntryType_code_key" ON "VisaEntryType"("code");
CREATE UNIQUE INDEX "VisaEntryType_name_key" ON "VisaEntryType"("name");

-- The two entry types the products already use (the former enum values), so nothing changes for them.
INSERT INTO "VisaEntryType" ("id", "code", "name", "active", "displayOrder", "updatedAt")
VALUES ('visa_entry_type_single', 'SINGLE', 'Single Entry', true, 1, CURRENT_TIMESTAMP),
       ('visa_entry_type_multiple', 'MULTIPLE', 'Multiple Entry', true, 2, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

ALTER TABLE "NewVisaCountryConfig" ALTER COLUMN "entryKind" TYPE TEXT USING "entryKind"::text;

DROP TYPE "NewVisaEntryKind";
