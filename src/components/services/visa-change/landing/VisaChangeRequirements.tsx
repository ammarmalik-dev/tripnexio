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

// Locked content — doc §9 "Documents Required" (the real checklist is
// nationality-based and Admin-configured, so no universal list).
const documents = [
  { name: "Passport", required: true, caption: "Passport copy as requested" },
  { name: "Passport Photograph", required: true, caption: "Recent photograph when required" },
  { name: "Additional Documents", required: false, caption: "Nationality/service-specific documents where required" },
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
