export interface SelectOption {
  value: string;
  label: string;
}

/**
 * SAMPLE DATA ONLY. Illustrative airline options for request-form previews
 * across service flows (OTB, Flight Special Fare, Return Verified Ticket).
 * Not an authoritative or complete list — the confirmed list is managed by
 * our team via Admin-managed masters (see CLAUDE.md hard rule #1). Pair
 * any select built from this with SAMPLE_DATA_CAPTION so users don't read
 * it as final.
 */
export const SAMPLE_AIRLINE_OPTIONS: SelectOption[] = [
  { value: "EK", label: "Emirates" },
  { value: "EY", label: "Etihad Airways" },
  { value: "G9", label: "Air Arabia" },
  { value: "QR", label: "Qatar Airways" },
  { value: "6E", label: "IndiGo" },
  { value: "AI", label: "Air India" },
];

export const SAMPLE_DATA_CAPTION =
  "Sample airlines shown for preview — the confirmed list is managed by our team.";

/**
 * SAMPLE DATA ONLY. Illustrative visa-type categories for request-form
 * previews. Exact visa categories and eligibility differ per destination
 * country and change with embassy/immigration policy — this is not an
 * authoritative list. The confirmed category is set by our team once they
 * review the request (see CLAUDE.md hard rule #1).
 */
export const SAMPLE_VISA_TYPE_OPTIONS: SelectOption[] = [
  { value: "tourist", label: "Tourist Visa" },
  { value: "business", label: "Business Visa" },
  { value: "employment", label: "Employment Visa" },
  { value: "family-visit", label: "Family Visit Visa" },
];

export const SAMPLE_VISA_TYPE_CAPTION =
  "Sample categories shown for preview — our team confirms the exact visa type for you.";

/**
 * Destination countries are the actual locked market scope from CLAUDE.md
 * (India to UAE/GCC only) — not sample/placeholder data.
 */
export const DESTINATION_COUNTRY_OPTIONS: SelectOption[] = [
  { value: "uae", label: "United Arab Emirates" },
  { value: "saudi-arabia", label: "Saudi Arabia" },
  { value: "bahrain", label: "Bahrain" },
  { value: "kuwait", label: "Kuwait" },
  { value: "oman", label: "Oman" },
  { value: "qatar", label: "Qatar" },
];
