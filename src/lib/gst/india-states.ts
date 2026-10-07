/**
 * Client corrections 2026-10-05 (invoice sample) — the GST state / union
 * territory codes printed as "State Code" and "Place of Supply" on a tax
 * invoice. These are the statutory GST codes (the first two digits of every
 * GSTIN), not business data; "96" is the GST code for a place of supply
 * outside India (a worldwide customer).
 */
export const GST_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "96", name: "Outside India" },
] as const;

export type GstStateCode = (typeof GST_STATES)[number]["code"];
export const GST_STATE_CODES = GST_STATES.map((state) => state.code) as [GstStateCode, ...GstStateCode[]];

export function gstStateName(code: string | null | undefined): string | null {
  return GST_STATES.find((state) => state.code === code)?.name ?? null;
}

/** GSTIN format: 2-digit state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The state code a GSTIN belongs to (its first two digits), or null. */
export function gstinStateCode(gstin: string | null | undefined): string | null {
  const value = gstin?.trim().toUpperCase();
  return value && GSTIN_PATTERN.test(value) ? value.slice(0, 2) : null;
}
