/**
 * P26 — column specs for the Admin CSV imports served by
 * /api/admin/import/[entity]. Client-safe (no server imports): the
 * CsvImportPanel renders the column list and the headers-only template from
 * the same spec the server parses against, so the two can't drift.
 *
 * Conventions shared by every entity:
 *   - Header names are case-insensitive, any column order; extra columns are ignored.
 *   - A blank optional cell means "use the default" on create and "leave unchanged" on update.
 *   - Booleans accept true/false, yes/no, y/n, 1/0.
 *   - Service types are the ServiceType codes (NEW_VISA, VISA_EXTENSION, VISA_CHANGE,
 *     FLIGHT_SPECIAL_FARE, RETURN_TICKET, OTB, OTHER); pax types are ADULT/CHILD/INFANT.
 *   - Countries are referenced by their Admin → Countries code (the name is accepted too).
 *   - Dates are YYYY-MM-DD.
 */

export const IMPORT_ENTITY_KEYS = ["airlines", "borders", "vendors", "pricing-rules", "document-requirements"] as const;
export type ImportEntityKey = (typeof IMPORT_ENTITY_KEYS)[number];

export function isImportEntityKey(value: string): value is ImportEntityKey {
  return (IMPORT_ENTITY_KEYS as readonly string[]).includes(value);
}

export interface ImportColumnSpec {
  name: string;
  required: boolean;
  /** Short, admin-facing hint shown next to the column name. */
  hint: string;
}

export interface ImportEntitySpec {
  /** Plural, human label ("Airlines"). */
  label: string;
  /** How existing rows are matched, shown in the panel. */
  matchedBy: string;
  /** Business Rules §14 — price / vendor / document-requirement changes need a confirmation reason on commit. */
  sensitive: boolean;
  columns: readonly ImportColumnSpec[];
}

const col = (name: string, required: boolean, hint: string): ImportColumnSpec => ({ name, required, hint });

export const IMPORT_SPECS: Record<ImportEntityKey, ImportEntitySpec> = {
  airlines: {
    label: "Airlines",
    matchedBy: "IATA code",
    sensitive: false,
    columns: [
      col("code", true, "2-3 letter IATA code (the match key)"),
      col("name", true, "Airline name"),
      col("country", true, "Country code or name (stored as the country's name when it matches Admin → Countries)"),
      col("otb_required", false, "true/false (default false)"),
      col("normal_price", false, "OTB normal price, ₹"),
      col("urgent_price", false, "OTB urgent price, ₹"),
      col("standard_processing_days", false, "Working days (1-365)"),
      col("urgent_processing_hours", false, "Working hours (0-200)"),
      col("logo_url", false, "Logo URL (auto-filled from the code when blank on create)"),
      col("display_order", false, "Integer (default 0)"),
      col("active", false, "true/false (default true)"),
    ],
  },
  borders: {
    label: "Borders",
    matchedBy: "crossing name + country",
    sensitive: false,
    columns: [
      col("name", true, "Crossing name (match key, with country_code)"),
      col("country_code", true, "The non-UAE side's country code"),
      col("uae_location", true, "UAE-side location"),
      col("destination_location", true, "Destination-side location"),
      col("active_for_visa_change", false, "true/false (default true)"),
      col("display_order", false, "Integer (default 0)"),
      col("active", false, "true/false (default true)"),
    ],
  },
  vendors: {
    label: "Vendors",
    matchedBy: "vendor name",
    sensitive: true,
    columns: [
      col("name", true, "Vendor name (the match key, case-insensitive)"),
      col("services", true, "Service type codes separated by | (e.g. NEW_VISA|OTB) — replaces the vendor's service list"),
      col("mobile", false, "Contact number"),
      col("email", false, "Contact email"),
      col("poc_name", false, "Point-of-contact name"),
      col("gst_number", false, "GST number"),
      col("availability", false, "Free text"),
      col("processing_details", false, "Free text"),
      col("payment_details", false, "Free text"),
      col("service_suitability_score", false, "1-5 (default 3)"),
      col("processing_time_score", false, "1-5 (default 3)"),
      col("performance_score", false, "1-5 (default 3)"),
      col("reliability_score", false, "1-5 (default 3)"),
      col("active", false, "true/false (default true)"),
    ],
  },
  "pricing-rules": {
    label: "Pricing Rules",
    matchedBy: "service + country + processing type + pax type + sub-service + nationality",
    sensitive: true,
    columns: [
      col("service_type", true, "ServiceType code"),
      col("country_code", false, "Destination country code (blank = not tied to a country)"),
      col("processing_type", false, "Processing Types code for that service (blank = any)"),
      col("pax_type", true, "ADULT / CHILD / INFANT"),
      col("sub_service_code", false, "Sub-service code of that service (blank = every sub-service)"),
      col("nationality", false, "Nationality name from Admin → Nationalities (blank = every nationality)"),
      col("vendor_cost", false, "₹ (default 0, internal)"),
      col("selling_price", true, "₹"),
      col("additional_charges", false, "₹ (default 0)"),
      col("validity_from", false, "YYYY-MM-DD"),
      col("validity_until", false, "YYYY-MM-DD"),
      col("active", false, "true/false (default true)"),
    ],
  },
  "document-requirements": {
    label: "Document Requirements",
    matchedBy: "service + country + nationality + pax type + document name",
    sensitive: true,
    columns: [
      col("service_type", true, "ServiceType code"),
      col("country_code", false, "Destination country code (blank = every country)"),
      col("nationality", false, "Nationality name from Admin → Nationalities (blank = every nationality)"),
      col("pax_type", false, "ADULT / CHILD / INFANT (blank = every passenger type)"),
      col("document_name", true, "Document name"),
      col("required", false, "true/false (default true)"),
      col("active", false, "true/false (default true)"),
    ],
  },
};

export function requiredColumns(spec: ImportEntitySpec): string[] {
  return spec.columns.filter((column) => column.required).map((column) => column.name);
}

export type ImportRowAction = "create" | "update" | "error";

export interface ImportRowResult {
  line: number;
  /** Human-readable natural key, e.g. "EK" or "NEW_VISA / AE / normal / ADULT". */
  key: string;
  action: ImportRowAction;
  errors: string[];
}

export interface ImportPreviewResult {
  entity: ImportEntityKey;
  filename: string | null;
  totals: { create: number; update: number; error: number };
  rows: ImportRowResult[];
}

export interface ImportCommitResult {
  entity: ImportEntityKey;
  filename: string | null;
  created: number;
  updated: number;
  skipped: number;
  rows: ImportRowResult[];
}
