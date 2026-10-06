-- Client corrections 2026-10-05: service-wise SAC code on invoices (blank = the
-- Invoice Settings default). No value is seeded: SAC codes come from the client.
ALTER TABLE "Service" ADD COLUMN "sacCode" TEXT;
