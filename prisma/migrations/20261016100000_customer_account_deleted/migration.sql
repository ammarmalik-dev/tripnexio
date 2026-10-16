-- Client doc 2026-10-15 (J7) — a customer can delete their account (login removed, records kept as legally required).
ALTER TABLE "Customer" ADD COLUMN "accountDeletedAt" TIMESTAMP(3);
