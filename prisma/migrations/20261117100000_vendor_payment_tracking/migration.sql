-- Client doc 16 Nov (I10) — vendor / sponsor Credit / Paid tracking per booking.
ALTER TABLE "Booking" ADD COLUMN "vendorPaidAmount" DECIMAL(10,2);
ALTER TABLE "Booking" ADD COLUMN "vendorPaidAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "vendorPaymentRef" TEXT;
