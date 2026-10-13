-- Client doc 2026-10-14: each service's "before payment" Terms & Conditions carry
-- their own checkbox sentence, and the client's final T&C text for Special Fare
-- (Domestic + International), Return Verified Ticket and OTB is published as a new
-- version. Older versions stay in the table, and bookings keep the version that
-- was accepted. Nothing is deleted.

-- AlterTable
ALTER TABLE "ServiceTerms" ADD COLUMN     "acceptanceText" TEXT;

-- Flight Special Fare: the same text for Domestic and International routes.
INSERT INTO "ServiceTerms" ("id", "serviceType", "countryId", "flightScope", "version", "title", "body", "acceptanceText", "active", "updatedAt")
SELECT
  'terms-sf-' || lower(scope) || '-20261014',
  'FLIGHT_SPECIAL_FARE',
  NULL,
  scope::"FlightScope",
  COALESCE((SELECT MAX(t."version") FROM "ServiceTerms" t WHERE t."serviceType" = 'FLIGHT_SPECIAL_FARE' AND t."countryId" IS NULL AND t."flightScope" = scope::"FlightScope"), 0) + 1,
  'Important – Before Payment',
  E'Please verify all passenger names, travel dates, flight timings, routes and other booking details carefully before proceeding with payment.\n\nUpload clear and valid passenger documents as required for your journey.\n\nEnsure you have the necessary passport, visa, transit documents and valid government-issued ID, as applicable to your travel.\n\nCheck the baggage allowance, departure terminal and travel requirements before confirming your booking.\n\nAfter ticket issuance, report any errors in passenger names or ticket details to TripNexio within 12 hours of issuance. Corrections are subject to airline rules and applicable charges.',
  'I confirm that I have checked all passenger details, travel dates, flight timings, routes and uploaded documents. I understand that I am responsible for carrying the required travel documents and must report any ticket errors to TripNexio within 12 hours of ticket issuance.',
  true,
  CURRENT_TIMESTAMP
FROM (VALUES ('DOMESTIC'), ('INTERNATIONAL')) AS scopes(scope)
ON CONFLICT ("id") DO NOTHING;

-- Return Verified Ticket.
INSERT INTO "ServiceTerms" ("id", "serviceType", "countryId", "flightScope", "version", "title", "body", "acceptanceText", "active", "updatedAt")
VALUES (
  'terms-rt-20261014',
  'RETURN_TICKET',
  NULL,
  NULL,
  COALESCE((SELECT MAX(t."version") FROM "ServiceTerms" t WHERE t."serviceType" = 'RETURN_TICKET' AND t."countryId" IS NULL AND t."flightScope" IS NULL), 0) + 1,
  'Return Verified Ticket — Terms & Conditions',
  E'Document Requirements: Please provide accurate passenger details and upload a clear passport copy. A visa copy may be required where applicable. Additional documents may be requested if necessary.\n\nRefund Before Processing: If your documents have been validated but your request has not yet been forwarded to the airline/partner and no ticket has been issued, you are eligible for a refund, less applicable payment gateway charges.\n\nNon-Refundable Stage: Once your validated request has been forwarded to the airline/partner for processing, or the ticket/reservation has been issued, the booking becomes non-refundable.\n\nReservation & Travel Disclaimer: Ticket issuance depends on availability and airline/partner processing. TripNexio does not guarantee boarding, visa approval, immigration clearance or entry into any country.\n\nBy proceeding with payment, you confirm that your details and documents are accurate and agree to these Terms & Conditions.',
  'I have read and agree to the Return Verified Ticket Terms & Conditions, including the refund and non-refundable processing policy.',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- OTB (OK to Board).
INSERT INTO "ServiceTerms" ("id", "serviceType", "countryId", "flightScope", "version", "title", "body", "acceptanceText", "active", "updatedAt")
VALUES (
  'terms-otb-20261014',
  'OTB',
  NULL,
  NULL,
  COALESCE((SELECT MAX(t."version") FROM "ServiceTerms" t WHERE t."serviceType" = 'OTB' AND t."countryId" IS NULL AND t."flightScope" IS NULL), 0) + 1,
  'OTB (OK to Board) – Terms & Conditions',
  E'Accurate Information: Customers must provide correct passenger names, passport details, airline, destination, and travel date.\n\nRequired Documents: All documents required by the selected airline must be provided. Additional documents may be requested if necessary.\n\nProcessing Time: Processing depends on the selected airline, travel date, working hours, and operational conditions. Please check the applicable Normal or Urgent processing time before payment.\n\nNo Guarantee of Approval: OTB is subject to airline confirmation. Payment does not guarantee OTB approval or completion before departure.\n\nTravel Disclaimer: OTB confirmation does not guarantee boarding, immigration clearance, or entry into any country. Final decisions rest with the airline and relevant authorities.\n\nDelays: Processing may be delayed due to airline procedures, document issues, holidays, or circumstances beyond TripNexio’s control.\n\nCancellation & Refund Policy: If documents have been validated but the request has not yet been forwarded to the airline, the customer is eligible for a refund after deducting applicable payment gateway charges. Once the request has been forwarded to the airline, no refund will be provided.\n\nCustomer Acceptance: By proceeding with payment, customers confirm that their information is accurate and that they accept these terms.',
  'I have read and agree to the OTB Terms & Conditions, including the cancellation and refund policy.',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
