import { ServiceRequirementsSection } from "@/components/services/ServiceRequirementsSection";

// Locked content — doc §8 "What You'll Need". Client correction 2026-10-05:
// ask for the visa expiry date (not "last date"); the eligibility block is removed.
const whatYoullNeed = [
  { label: "Full name", detail: "Applicant / passenger name" },
  { label: "Mobile number", detail: "Active contact number" },
  { label: "Email address", detail: "Email for updates and confirmations" },
  { label: "Passport number", detail: "Required passenger identifier" },
  { label: "Visa expiry date", detail: "Expiry date of your current visa" },
  { label: "Nationality", detail: "Used for applicable documents and nationality-wise pricing" },
];

// Client testing 2026-10-09 (B22/B23) — the client's list, uploaded after payment
// (only the visa copy is asked before payment, in the request form).
const documents = [
  { name: "Passport Front Page", required: true, caption: "Required" },
  { name: "Passport Last Page", required: true, caption: "Required" },
  { name: "Recent Photograph", required: true, caption: "Recent passport-size photograph as per the required specifications." },
  {
    name: "Additional Documents",
    required: false,
    caption: "Additional documents may be required depending on the applicant’s nationality and applicable immigration requirements.",
  },
];

/** Doc §8 "What You'll Need" and §9 "Documents Required", in the shared service layout. */
export function VisaChangeRequirements() {
  return (
    <ServiceRequirementsSection
      whatYouNeed={whatYoullNeed}
      documents={documents}
      notes={[
        "You can add another passenger. Each passenger has their own nationality and Adult/Child details.",
        "Document requirements may vary by nationality and application. Additional documents may be requested where required.",
        "Actual upload occurs after successful payment. Existing valid documents may be reused where available.",
      ]}
    />
  );
}
