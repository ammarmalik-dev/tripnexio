-- Client doc 2026-10-15 (G5) — gateway charge charged to the customer (default, as before) or absorbed by TripNexio.
ALTER TABLE "TaxFeeConfig" ADD COLUMN "gatewayFeeChargedToCustomer" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Payment" ADD COLUMN "gatewayFeeAbsorbed" DECIMAL(10,2) NOT NULL DEFAULT 0;
-- Client doc 2026-10-15 (G6) — Admin's later edit of a payment's invoice (lines and GST).
ALTER TABLE "Payment" ADD COLUMN "invoiceOverride" JSONB;
