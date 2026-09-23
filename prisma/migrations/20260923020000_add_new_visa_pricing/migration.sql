-- CreateTable
CREATE TABLE "NewVisaPricing" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "adultPrice" DECIMAL(10,2) NOT NULL,
    "childPrice" DECIMAL(10,2) NOT NULL,
    "infantPrice" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewVisaPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewVisaPricing_active_idx" ON "NewVisaPricing"("active");

-- CreateIndex
CREATE UNIQUE INDEX "NewVisaPricing_countryId_processingType_key" ON "NewVisaPricing"("countryId", "processingType");

-- AddForeignKey
ALTER TABLE "NewVisaPricing" ADD CONSTRAINT "NewVisaPricing_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

