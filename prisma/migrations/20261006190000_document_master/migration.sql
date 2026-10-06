-- Client corrections 2026-10-05: Document Master. Every document is defined once and
-- countries/services pick it (DocumentRequirement.documentTypeId). The master list
-- is filled from the document names already configured (nothing new is invented),
-- and each existing requirement is linked to its entry.

-- AlterTable
ALTER TABLE "DocumentRequirement" ADD COLUMN     "documentTypeId" TEXT;

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultMandatory" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_name_key" ON "DocumentType"("name");

-- CreateIndex
CREATE INDEX "DocumentType_active_idx" ON "DocumentType"("active");

-- CreateIndex
CREATE INDEX "DocumentRequirement_documentTypeId_idx" ON "DocumentRequirement"("documentTypeId");

-- AddForeignKey
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: one master entry per distinct configured document name.
INSERT INTO "DocumentType" ("id", "name", "defaultMandatory", "active", "updatedAt")
SELECT 'dt_' || md5(names.name), names.name, names.mandatory, true, CURRENT_TIMESTAMP
FROM (
  SELECT btrim("documentName") AS name, bool_or("required") AS mandatory
  FROM "DocumentRequirement"
  WHERE btrim("documentName") <> ''
  GROUP BY btrim("documentName")
) AS names
ON CONFLICT ("name") DO NOTHING;

UPDATE "DocumentRequirement" r
SET "documentTypeId" = t."id"
FROM "DocumentType" t
WHERE r."documentTypeId" IS NULL AND btrim(r."documentName") = t."name";
