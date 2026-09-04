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
