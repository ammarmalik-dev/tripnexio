
-- CreateEnum
CREATE TYPE "OcrExtractionStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "PassportExtraction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "OcrExtractionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "extractedFields" JSONB NOT NULL,
    "mrzRaw" TEXT,
    "mrzValid" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PassportExtraction_documentId_idx" ON "PassportExtraction"("documentId");

-- CreateIndex
CREATE INDEX "PassportExtraction_passengerId_idx" ON "PassportExtraction"("passengerId");

-- CreateIndex
CREATE INDEX "PassportExtraction_status_idx" ON "PassportExtraction"("status");

-- AddForeignKey
ALTER TABLE "PassportExtraction" ADD CONSTRAINT "PassportExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportExtraction" ADD CONSTRAINT "PassportExtraction_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportExtraction" ADD CONSTRAINT "PassportExtraction_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

