-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "customerToken" TEXT;

-- CreateTable
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_customerToken_key" ON "Booking"("customerToken");

