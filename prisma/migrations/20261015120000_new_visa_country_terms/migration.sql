-- Client doc 2026-10-15 — "Create editable Terms & Conditions for each country, with a checkbox and an
-- 'Accept & Proceed to Payment' button. Prepare a default draft that Admin can edit for each country."
-- One draft per country that has a New Visa product and no country terms yet. Where Admin already
-- wrote all-countries New Visa terms (not the SAMPLE seed), those are copied instead of the draft, so
-- nothing the client wrote is replaced. Admin edits them in Service Configuration → New Visa → Terms.
INSERT INTO "ServiceTerms" ("id", "serviceType", "countryId", "flightScope", "version", "title", "body", "acceptanceText", "active", "updatedAt")
SELECT
  'terms-nv-' || c."id" || '-20261015',
  'NEW_VISA',
  c."id",
  NULL,
  1,
  COALESCE(g."title", c."name" || ' Visa – Terms & Conditions'),
  COALESCE(
    g."body",
    E'Accurate Information: Customers must provide correct applicant names, passport details, nationality, travel dates and contact details. Applications are processed exactly as submitted.\n\n'
    || E'Documents: Required documents are uploaded after payment. Documents must be clear, valid and in colour (PDF, PNG or JPG, under 3 MB). Additional documents may be requested by TripNexio or the issuing authority.\n\n'
    || E'Passport Validity: The passport should be valid for at least 6 months from the date of travel, with blank pages as required by ' || c."name" || E'.\n\n'
    || E'Processing Time: The expected approval date is an estimate based on working days and holidays. Normal and Express timelines depend on the issuing authority and are not guaranteed.\n\n'
    || E'No Guarantee of Approval: The visa, eTA or arrival card is issued at the sole discretion of the ' || c."name" || E' authorities. Payment does not guarantee approval, and TripNexio cannot influence the decision.\n\n'
    || E'Fees & Refunds: Fees cover processing and government / vendor charges. If your documents have not yet been submitted to the authority, a refund is available after deducting applicable payment gateway charges. Once the application has been submitted, the fee is non-refundable, including when the application is rejected.\n\n'
    || E'Travel Disclaimer: An approved visa does not guarantee boarding or entry. Final decisions rest with the airline and immigration authorities.\n\n'
    || E'Customer Acceptance: By proceeding with payment, the customer confirms that the information provided is accurate and agrees to these Terms & Conditions.'
  ),
  COALESCE(
    g."acceptanceText",
    'I have read and agree to the ' || c."name" || ' Visa Terms & Conditions, including the processing, approval and refund policy.'
  ),
  true,
  CURRENT_TIMESTAMP
FROM "Country" c
LEFT JOIN LATERAL (
  SELECT t."title", t."body", t."acceptanceText"
  FROM "ServiceTerms" t
  WHERE t."serviceType" = 'NEW_VISA' AND t."countryId" IS NULL AND t."active" = true
    AND t."body" NOT ILIKE '%sample%' AND t."title" NOT ILIKE '%sample%'
  ORDER BY t."version" DESC
  LIMIT 1
) g ON true
WHERE EXISTS (SELECT 1 FROM "NewVisaCountryConfig" n WHERE n."countryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "ServiceTerms" t WHERE t."serviceType" = 'NEW_VISA' AND t."countryId" = c."id");
