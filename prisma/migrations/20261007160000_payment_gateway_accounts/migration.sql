-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('RAZORPAY', 'CASHFREE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gatewayAccountId" TEXT;

-- CreateTable
CREATE TABLE "PaymentGatewayAccount" (
    "id" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "envPrefix" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckOk" BOOLEAN,
    "lastCheckMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "bookingId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentGatewayAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayAccount_envPrefix_key" ON "PaymentGatewayAccount"("envPrefix");

-- CreateIndex
CREATE INDEX "PaymentGatewayAccount_active_priority_idx" ON "PaymentGatewayAccount"("active", "priority");

-- CreateIndex
CREATE INDEX "PaymentGatewayAttempt_paymentId_idx" ON "PaymentGatewayAttempt"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentGatewayAttempt_bookingId_idx" ON "PaymentGatewayAttempt"("bookingId");

-- CreateIndex
CREATE INDEX "PaymentGatewayAttempt_accountId_createdAt_idx" ON "PaymentGatewayAttempt"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gatewayAccountId_fkey" FOREIGN KEY ("gatewayAccountId") REFERENCES "PaymentGatewayAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGatewayAttempt" ADD CONSTRAINT "PaymentGatewayAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGatewayAttempt" ADD CONSTRAINT "PaymentGatewayAttempt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentGatewayAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The existing single Razorpay configuration (RAZORPAY_* env vars) becomes
-- the primary account; further accounts are added from Admin.
INSERT INTO "PaymentGatewayAccount" ("id", "provider", "label", "envPrefix", "priority", "active", "updatedAt")
VALUES ('pgw_razorpay_primary', 'RAZORPAY', 'Razorpay (primary)', 'RAZORPAY', 1, true, CURRENT_TIMESTAMP)
ON CONFLICT ("envPrefix") DO NOTHING;
