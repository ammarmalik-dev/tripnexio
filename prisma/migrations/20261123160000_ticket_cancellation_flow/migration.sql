-- Client doc 16 Nov (A12-A14): Special Fare ticket cancellation / airline cancellation / reschedule flow.
ALTER TABLE "Booking" ADD COLUMN "ticketCancellation" JSONB;
ALTER TABLE "RefundConfig" ADD COLUMN "ticketCancellationServiceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;
