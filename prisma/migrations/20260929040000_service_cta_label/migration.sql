-- P05: per-service homepage CTA label (Homepage_FINAL_Locked_1of1.docx §4).
ALTER TABLE "Service" ADD COLUMN "ctaLabel" TEXT NOT NULL DEFAULT '';

UPDATE "Service" SET "ctaLabel" = 'Apply Now'           WHERE "code" = 'NEW_VISA'            AND "ctaLabel" = '';
UPDATE "Service" SET "ctaLabel" = 'Extend Visa'         WHERE "code" = 'VISA_EXTENSION'      AND "ctaLabel" = '';
UPDATE "Service" SET "ctaLabel" = 'Start Visa Change'   WHERE "code" = 'VISA_CHANGE'         AND "ctaLabel" = '';
UPDATE "Service" SET "ctaLabel" = 'Get Special Fare'    WHERE "code" = 'FLIGHT_SPECIAL_FARE' AND "ctaLabel" = '';
UPDATE "Service" SET "ctaLabel" = 'Get Verified Ticket' WHERE "code" = 'RETURN_TICKET'       AND "ctaLabel" = '';
UPDATE "Service" SET "ctaLabel" = 'Apply for OTB'       WHERE "code" = 'OTB'                 AND "ctaLabel" = '';

-- Locked card copy, applied only where the row still holds the original
-- seeded text (never overwrites an Admin edit).
UPDATE "Service" SET "shortDescription" = 'Apply for a new visa with our simple, guided process.'
  WHERE "code" = 'NEW_VISA' AND "shortDescription" = 'Apply for a new UAE or GCC visa with our simple, guided process.';
UPDATE "Service" SET "shortDescription" = 'Get specially sourced group fares at discounted prices with flexible travel options.'
  WHERE "code" = 'FLIGHT_SPECIAL_FARE' AND "shortDescription" = 'Official special fare flight bookings through our airline and vendor partners.';
UPDATE "Service" SET "shortDescription" = 'Get a verified return ticket for travel purposes.'
  WHERE "code" = 'RETURN_TICKET' AND "shortDescription" = 'A verified return ticket for use with your visa application.';
UPDATE "Service" SET "shortDescription" = 'Complete your OK to Board clearance for hassle-free airline check-in and boarding.'
  WHERE "code" = 'OTB' AND "shortDescription" = 'Airline Ok-to-Board authorization arranged for your departure.';
UPDATE "Service" SET "name" = 'OTB - OK to Board'
  WHERE "code" = 'OTB' AND "name" = 'OTB - Ok to Board';
