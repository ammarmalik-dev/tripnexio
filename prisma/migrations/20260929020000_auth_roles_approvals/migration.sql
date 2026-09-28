-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "raisedByUserId" TEXT;

-- Backfill: the staff user on each refund's first AuditTrail CREATE row, where one exists. Additive only.
UPDATE "Refund" AS r
SET "raisedByUserId" = a."byUserId"
FROM (
  SELECT DISTINCT ON ("entityId") "entityId", "byUserId"
  FROM "AuditTrail"
  WHERE "entityType" = 'Refund' AND "action" = 'CREATE' AND "byUserId" IS NOT NULL
  ORDER BY "entityId", "timestamp"
) AS a
WHERE a."entityId" = r."id" AND r."raisedByUserId" IS NULL;

-- AlterTable
ALTER TABLE "WhatsAppMessageLog" ADD COLUMN     "waMessageId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CustomerOtp" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerOtp_customerId_idx" ON "CustomerOtp"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessageLog_waMessageId_key" ON "WhatsAppMessageLog"("waMessageId");

-- AddForeignKey
ALTER TABLE "CustomerOtp" ADD CONSTRAINT "CustomerOtp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
