-- Client doc 16 Nov (H8, §8 "Bank transfer refund") — the transaction number and date of a bank-transfer refund.
ALTER TABLE "Refund" ADD COLUMN "bankTransactionRef" TEXT;
ALTER TABLE "Refund" ADD COLUMN "bankTransactionDate" TIMESTAMP(3);
