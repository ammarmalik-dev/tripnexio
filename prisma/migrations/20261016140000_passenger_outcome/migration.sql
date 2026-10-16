-- Client doc 2026-10-15 (I4) — passenger-level approval / rejection / cancellation on a booking.
CREATE TYPE "PassengerOutcome" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "BookingPassenger" ADD COLUMN "outcome" "PassengerOutcome";
ALTER TABLE "BookingPassenger" ADD COLUMN "outcomeNote" TEXT;
ALTER TABLE "BookingPassenger" ADD COLUMN "outcomeAt" TIMESTAMP(3);
