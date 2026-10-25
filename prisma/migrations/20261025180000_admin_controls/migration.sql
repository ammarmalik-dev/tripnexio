-- Client 2026-10-25 ("do everything the docs ask before launch") — Admin handover §1, §6, §12, §17.
-- Additive only: new nullable / defaulted columns and two new tables. No existing data changes.

-- §17 coupons limited to services (empty = every service)
ALTER TABLE "Coupon" ADD COLUMN "serviceTypes" "ServiceType"[] NOT NULL DEFAULT ARRAY[]::"ServiceType"[];

-- §17 refund approval limit per staff member (null = no limit)
ALTER TABLE "User" ADD COLUMN "refundApprovalLimit" DECIMAL(10,2);

-- §12 vendor <-> sub-service (empty = every sub-service of that service)
ALTER TABLE "VendorService" ADD COLUMN "subServiceCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- §1 service-wise staff permissions
CREATE TABLE "StaffServicePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffServicePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffServicePermission_userId_serviceType_key" ON "StaffServicePermission"("userId", "serviceType");
CREATE INDEX "StaffServicePermission_serviceType_idx" ON "StaffServicePermission"("serviceType");
ALTER TABLE "StaffServicePermission" ADD CONSTRAINT "StaffServicePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- §6 country timelines for Return Ticket / Visa Extension / Visa Change / Special Fare
CREATE TABLE "ServiceCountryTimeline" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "countryId" TEXT NOT NULL,
    "documentVerificationHours" INTEGER,
    "expectedCompletionHours" INTEGER,
    "quotationResponseMinutes" INTEGER,
    "paymentDeadlineHours" INTEGER,
    "processingDaysNormal" INTEGER,
    "processingDaysExpress" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceCountryTimeline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceCountryTimeline_serviceType_countryId_key" ON "ServiceCountryTimeline"("serviceType", "countryId");
CREATE INDEX "ServiceCountryTimeline_countryId_idx" ON "ServiceCountryTimeline"("countryId");
ALTER TABLE "ServiceCountryTimeline" ADD CONSTRAINT "ServiceCountryTimeline_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;
