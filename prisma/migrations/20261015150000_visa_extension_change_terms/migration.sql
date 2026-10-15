-- Client doc 2026-10-15 (D4, E5) — the client's UAE Visa Extension and Visa Change Terms & Conditions and
-- checkbox sentences, published as a new all-countries version. Older versions stay; bookings keep the
-- version that was accepted. Nothing is deleted.

INSERT INTO "ServiceTerms" ("id", "serviceType", "countryId", "flightScope", "version", "title", "body", "acceptanceText", "active", "updatedAt")
VALUES (
  'terms-ve-20261015',
  'VISA_EXTENSION',
  NULL,
  NULL,
  COALESCE((SELECT MAX(t."version") FROM "ServiceTerms" t WHERE t."serviceType" = 'VISA_EXTENSION' AND t."countryId" IS NULL AND t."flightScope" IS NULL), 0) + 1,
  E'UAE Visa Extension – Terms & Conditions',
  E'Eligibility: This service is available only for UAE visas originally issued through TripNexio. If your visa cannot be verified, you may be guided to Visa Change.\n\nAccurate Information: Customers must provide correct passport details, visa expiry date, and other requested information. Eligibility will be confirmed after verification.\n\nDocuments: Additional documents may be requested if required. Existing documents will only be reused with customer confirmation.\n\nExtension Duration: The extension is for 30 days, subject to approval. The new validity is calculated from the original visa expiry date.\n\nFees & Fines: The final amount may include the extension fee, applicable overstay fines, and other charges. Fines are subject to the relevant authority\'s rules.\n\nPayment: Payment must be completed using the provided payment link within timeline. Expired links may need to be regenerated.\n\nUrgent Cases: If your visa expires today, urgent handling is required. The operational payment deadline is 6:00 PM on the same working day.\n\nCancellation & Refunds: If the request is not accepted, the applicable refund is the payment amount minus payment gateway charges. If the application is formally rejected, no refund will be provided under the current policy.\n\nApproval & Processing: Extension approval depends on eligibility checks and the relevant authorities. Payment does not guarantee approval.\n\nCustomer Acceptance: By proceeding with payment, customers confirm that the information provided is accurate and that they accept these Terms & Conditions.',
  E'I have read and agree to the UAE Visa Extension Terms & Conditions, including the refund policy.',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ServiceTerms" ("id", "serviceType", "countryId", "flightScope", "version", "title", "body", "acceptanceText", "active", "updatedAt")
VALUES (
  'terms-vc-20261015',
  'VISA_CHANGE',
  NULL,
  NULL,
  COALESCE((SELECT MAX(t."version") FROM "ServiceTerms" t WHERE t."serviceType" = 'VISA_CHANGE' AND t."countryId" IS NULL AND t."flightScope" IS NULL), 0) + 1,
  E'UAE Visa Change – Terms & Conditions',
  E'Eligibility & Approval: Visa Change is available to eligible customers currently inside the UAE. All visa applications are subject to immigration approval. Payment does not guarantee visa approval.\n\nProcessing Time: Processing time depends on immigration authorities, airline or transport availability, and operational conditions. Delays may occur beyond TripNexio’s control.\n\nCustomer Documents: Customers must provide accurate details and all required documents. If immigration authorities request additional documents, the customer must provide them promptly.\n\nAirport & Border Responsibility: Customers are responsible for meeting all immigration, visa, passport, and entry requirements. TripNexio is not responsible for immigration decisions, entry refusal, or legal issues arising from the customer\'s circumstances or failure to meet requirements.\n\nFlight & Border Transport: Customers must follow the confirmed flight or transport schedule and reporting instructions. If a customer misses the arranged flight or border transportation, no refund will be provided. Any new booking or additional arrangements will incur extra charges.\n\nAdditional Charges: Fines, immigration or border fees, and other excluded charges are the customer\'s responsibility unless explicitly included in the confirmed package.\n\nPackage Confirmation: The customer must review the selected method, travel details, package inclusions, exclusions, and final price before payment.\n\nCancellation After Package Generation: Once the package has been generated, the booking is non-refundable.\n\nFlight or Transport Cancellation: If the arranged flight or transport is cancelled by the airline or transport provider, TripNexio will attempt to arrange an alternative. If no suitable alternative is available, a refund will be provided for the affected booking, subject to the applicable refund process.\n\nCustomer Acceptance: By proceeding with payment, the customer confirms that the provided information is accurate and agrees to these Terms & Conditions.',
  E'I have read and agree to the Visa Change Terms & Conditions, including the immigration, transport, and refund policies.',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
