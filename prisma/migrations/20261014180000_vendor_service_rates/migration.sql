-- Client doc 2026-10-14 — vendor rates for OTB / Return Ticket by vendor, country, airline and processing type (internal).
-- CreateTable
CREATE TABLE "VendorServiceRate" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "countryId" TEXT NOT NULL,
    "airlineId" TEXT,
    "processingType" TEXT,
    "cost" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorServiceRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorServiceRate_vendorId_serviceType_idx" ON "VendorServiceRate"("vendorId", "serviceType");

-- CreateIndex
CREATE INDEX "VendorServiceRate_countryId_idx" ON "VendorServiceRate"("countryId");

-- AddForeignKey
ALTER TABLE "VendorServiceRate" ADD CONSTRAINT "VendorServiceRate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorServiceRate" ADD CONSTRAINT "VendorServiceRate_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorServiceRate" ADD CONSTRAINT "VendorServiceRate_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

