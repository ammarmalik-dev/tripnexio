/**
 * P10 — a New Visa product is one NewVisaCountryConfig row: a country +
 * stay duration (30 / 60 days) + Single / Multiple entry. Shared wording
 * for the product selector, the request form and lead details.
 */
export const ENTRY_KIND_LABELS: Record<string, string> = {
  SINGLE: "Single Entry",
  MULTIPLE: "Multiple Entry",
};

/**
 * Client doc 16 Nov (K8) — entry kinds are the Visa Entry Type master's codes now; a code without a built-in label
 * shows the product's stored entry text (set to the master's name on save), else the code itself.
 */
export function entryKindLabel(entryKind: string | null | undefined, stored?: string | null): string {
  if (!entryKind) return stored ?? "";
  return ENTRY_KIND_LABELS[entryKind] ?? (stored?.trim() || entryKind);
}

export const PRODUCT_CLASH_MESSAGE = "This country already has an option with the same stay duration, entry type, visa category and validity.";

/**
 * Client 2026-10-25 ("we have multiple options in one country") — the same country can carry several products;
 * only one with the same stay + entry + category + validity is a duplicate.
 */
export function newVisaProductClashWhere(key: {
  countryId: string;
  stayDays: number;
  entryKind: string;
  visaCategory: string;
  validityTypeId: string | null | undefined;
}) {
  return {
    countryId: key.countryId,
    stayDays: key.stayDays,
    entryKind: key.entryKind,
    visaCategory: { equals: key.visaCategory.trim(), mode: "insensitive" as const },
    validityTypeId: key.validityTypeId ?? null,
  };
}

export function productStayLabel(config: { stayDays: number | null; duration: string }): string {
  return config.stayDays ? `${config.stayDays} Days` : config.duration;
}

export function productEntryLabel(config: { entryKind: string | null; entryType: string }): string {
  return entryKindLabel(config.entryKind, config.entryType);
}

/**
 * Client doc 2026-10-20 (E7) — one line, in this order: Stay Duration · Entry Type · Visa Category
 * (website, WhatsApp bot and lead details alike).
 */
export function productLabel(config: {
  stayDays: number | null;
  duration: string;
  entryKind: string | null;
  entryType: string;
  visaCategory?: string | null;
  /** Client 2026-10-25 — several options per country: the validity tells two otherwise-equal options apart. */
  validityType?: { name: string } | null;
}): string {
  const category = config.visaCategory?.trim();
  const validity = config.validityType?.name.trim();
  return [productStayLabel(config), productEntryLabel(config), ...(category ? [category] : []), ...(validity ? [`Validity ${validity}`] : [])].join(" · ");
}

/** P10 defaults (UAE Visa Page Content FINAL §14): Normal needs 7 working days before travel, Express 3. Admin can change them in Timelines / SLA. */
export const DEFAULT_MIN_TRAVEL_DAYS = { normal: 7, urgent: 3 } as const;

export interface NewVisaTravelRules {
  minTravelDaysNormal: number;
  minTravelDaysExpress: number;
  /** Client corrections 2026-10-05 — processing working days for the Expected Approval Date; null = not configured (no date shown). */
  processingDaysNormal?: number | null;
  processingDaysExpress?: number | null;
}

/** Which processing types can still meet the travel date, given the working days until it. */
export function allowedProcessingTypes(workingDays: number, rules: NewVisaTravelRules): ("normal" | "urgent")[] {
  const allowed: ("normal" | "urgent")[] = [];
  if (workingDays >= rules.minTravelDaysNormal) allowed.push("normal");
  if (workingDays >= rules.minTravelDaysExpress) allowed.push("urgent");
  return allowed;
}
