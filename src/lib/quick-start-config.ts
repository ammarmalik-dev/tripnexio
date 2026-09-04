export type ServiceKey = "visa" | "flights" | "otb";

export interface ServiceTab {
  key: ServiceKey;
  label: string;
}

export const SERVICE_TABS: ServiceTab[] = [
  { key: "visa", label: "UAE Visa" },
  { key: "flights", label: "Flights" },
  { key: "otb", label: "OTB" },
];

export interface SelectOption {
  value: string;
  label: string;
}

export const VISA_SERVICE_OPTIONS: (SelectOption & { href: string })[] = [
  { value: "new-visa", label: "New Visa", href: "/services/new-visa" },
  { value: "visa-extension", label: "Visa Extension", href: "/services/visa-extension" },
  { value: "visa-change", label: "Visa Change", href: "/services/visa-change" },
];

/**
 * SAMPLE DATA ONLY. These airport/airline lists are illustrative placeholders
 * for the quick-start bar UI, not an authoritative or complete list. The real
 * options will come from Admin-managed masters (see CLAUDE.md hard rule #1).
 * A caption in the form makes this explicit to the user as well.
 */
export const SAMPLE_AIRPORT_OPTIONS: SelectOption[] = [
  { value: "DEL", label: "Delhi (DEL)" },
  { value: "BOM", label: "Mumbai (BOM)" },
  { value: "DXB", label: "Dubai (DXB)" },
  { value: "AUH", label: "Abu Dhabi (AUH)" },
  { value: "RUH", label: "Riyadh (RUH)" },
  { value: "JED", label: "Jeddah (JED)" },
  { value: "DOH", label: "Doha (DOH)" },
  { value: "KWI", label: "Kuwait City (KWI)" },
  { value: "MCT", label: "Muscat (MCT)" },
  { value: "BAH", label: "Manama (BAH)" },
];

export const SAMPLE_AIRLINE_OPTIONS: SelectOption[] = [
  { value: "EK", label: "Emirates" },
  { value: "EY", label: "Etihad Airways" },
  { value: "G9", label: "Air Arabia" },
  { value: "6E", label: "IndiGo" },
  { value: "AI", label: "Air India" },
];

export const SAMPLE_DATA_CAPTION =
  "Sample routes and airlines shown for preview — confirmed options are managed by our team.";

export const FLIGHTS_DESTINATION = {
  href: "/services/flight-special-fare",
  label: "Flight Special Fare",
};

export const OTB_DESTINATION = {
  href: "/services/otb",
  label: "OTB",
};

/** Must match the sticky main-nav row height in Navbar.tsx (`h-18` = 72px). */
export const NAV_DOCK_OFFSET_PX = 72;
