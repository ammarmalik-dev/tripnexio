-- Step 16 (client-locked-spec DEVELOPMENT_ROADMAP.md, audit §3.6):
-- CRM.md §17 (Ticket OCR) and §18 (Visa OCR) extend the existing
-- passport-only OCR pipeline (Phase 5D) to two more document types.
-- Generalizes PassportExtraction -> DocumentExtraction with an
-- extractionType discriminator, per the roadmap prompt's own preference
-- ("rather than bolting this onto the passport-specific model").
--
-- The old table is dropped and recreated rather than altered-in-place:
-- this dev database's 13 existing PassportExtraction rows are disposable
-- test fixtures from Phase 5D's own verification runs (per CLAUDE.md hard
-- rule #1, no real domain/customer data exists in this dev DB), and the
-- shape change (passengerId becoming optional, a new required
-- extractionType, a new optional bookingId) makes a straight ALTER
-- meaningfully more complex than a clean recreate for no real benefit here.

-- CreateEnum
CREATE TYPE "DocumentExtractionType" AS ENUM ('PASSPORT', 'TICKET', 'VISA');

-- DropTable
DROP TABLE "PassportExtraction";

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "passengerId" TEXT,
    "bookingId" TEXT,
    "extractionType" "DocumentExtractionType" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "OcrExtractionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "extractedFields" JSONB NOT NULL,
    "mrzRaw" TEXT,
    "mrzValid" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentExtraction_documentId_idx" ON "DocumentExtraction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_passengerId_idx" ON "DocumentExtraction"("passengerId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_bookingId_idx" ON "DocumentExtraction"("bookingId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_status_idx" ON "DocumentExtraction"("status");

-- CreateIndex
CREATE INDEX "DocumentExtraction_extractionType_idx" ON "DocumentExtraction"("extractionType");

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
