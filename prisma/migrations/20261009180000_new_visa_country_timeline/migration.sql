-- Client testing 2026-10-09 (B31) — New Visa timelines per destination country.
-- CreateTable
CREATE TABLE "NewVisaCountryTimeline" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "minTravelDaysNormal" INTEGER,
    "minTravelDaysExpress" INTEGER,
    "processingDaysNormal" INTEGER,
    "processingDaysExpress" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewVisaCountryTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewVisaCountryTimeline_countryId_key" ON "NewVisaCountryTimeline"("countryId");

-- AddForeignKey
ALTER TABLE "NewVisaCountryTimeline" ADD CONSTRAINT "NewVisaCountryTimeline_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

