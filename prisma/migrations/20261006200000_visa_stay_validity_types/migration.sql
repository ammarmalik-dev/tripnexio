-- Client corrections 2026-10-05: Visa Stay Type and Visa Validity Type masters.
-- Stay types start with the two locked New Visa stays (30 and 60 days, P10);
-- validity types are left for Admin to add.

-- AlterTable
ALTER TABLE "NewVisaCountryConfig" ADD COLUMN     "validityTypeId" TEXT;

-- CreateTable
CREATE TABLE "VisaStayType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaStayType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaValidityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisaValidityType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisaStayType_name_key" ON "VisaStayType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VisaStayType_days_key" ON "VisaStayType"("days");

-- CreateIndex
CREATE UNIQUE INDEX "VisaValidityType_name_key" ON "VisaValidityType"("name");

-- AddForeignKey
ALTER TABLE "NewVisaCountryConfig" ADD CONSTRAINT "NewVisaCountryConfig_validityTypeId_fkey" FOREIGN KEY ("validityTypeId") REFERENCES "VisaValidityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;


INSERT INTO "VisaStayType" ("id", "name", "days", "displayOrder", "updatedAt") VALUES
  ('vst_30', '30 Days', 30, 1, CURRENT_TIMESTAMP),
  ('vst_60', '60 Days', 60, 2, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
