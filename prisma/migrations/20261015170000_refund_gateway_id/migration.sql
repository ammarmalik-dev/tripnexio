-- Client doc 2026-10-15 (I5) — the gateway refund id / status on each refund, and when it completed.
ALTER TABLE "Refund" ADD COLUMN "gatewayRefundId" TEXT;
ALTER TABLE "Refund" ADD COLUMN "gatewayRefundStatus" TEXT;
ALTER TABLE "Refund" ADD COLUMN "completedAt" TIMESTAMP(3);
