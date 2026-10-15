/**
 * Client doc 2026-10-15 — "Prepare a default draft that Admin can edit for each country": the New
 * Visa Terms & Conditions a country starts with (same text as migration
 * 20261015120000_new_visa_country_terms). Admin edits it in Service Configuration → New Visa → Terms.
 */
export function newVisaDefaultTerms(countryName: string): { title: string; body: string; acceptanceText: string } {
  return {
    title: `${countryName} Visa – Terms & Conditions`,
    body: [
      "Accurate Information: Customers must provide correct applicant names, passport details, nationality, travel dates and contact details. Applications are processed exactly as submitted.",
      "Documents: Required documents are uploaded after payment. Documents must be clear, valid and in colour (PDF, PNG or JPG, under 3 MB). Additional documents may be requested by TripNexio or the issuing authority.",
      `Passport Validity: The passport should be valid for at least 6 months from the date of travel, with blank pages as required by ${countryName}.`,
      "Processing Time: The expected approval date is an estimate based on working days and holidays. Normal and Express timelines depend on the issuing authority and are not guaranteed.",
      `No Guarantee of Approval: The visa, eTA or arrival card is issued at the sole discretion of the ${countryName} authorities. Payment does not guarantee approval, and TripNexio cannot influence the decision.`,
      "Fees & Refunds: Fees cover processing and government / vendor charges. If your documents have not yet been submitted to the authority, a refund is available after deducting applicable payment gateway charges. Once the application has been submitted, the fee is non-refundable, including when the application is rejected.",
      "Travel Disclaimer: An approved visa does not guarantee boarding or entry. Final decisions rest with the airline and immigration authorities.",
      "Customer Acceptance: By proceeding with payment, the customer confirms that the information provided is accurate and agrees to these Terms & Conditions.",
    ].join("\n\n"),
    acceptanceText: `I have read and agree to the ${countryName} Visa Terms & Conditions, including the processing, approval and refund policy.`,
  };
}
