-- Step 44 (Admin FINAL handover §13): InvoiceConfig -- singleton holding
-- company GST/logo (no other home in the app yet) plus invoice-only fields
-- (bank/payment details, terms/notes, signatory). See the model's own
-- schema doc comment for the Step 44 vs. Step 45 field-ownership call.

-- CreateTable
CREATE TABLE "InvoiceConfig" (
    "id" TEXT NOT NULL,
    "companyGstNumber" TEXT,
    "companyLogoUrl" TEXT,
    "defaultSacCode" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "termsAndNotes" TEXT NOT NULL,
    "signatoryName" TEXT,
    "signatoryTitle" TEXT,
    "signatureImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceConfig_pkey" PRIMARY KEY ("id")
);
