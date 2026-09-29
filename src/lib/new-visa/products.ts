import type { NewVisaEntryKind } from "../../generated/prisma/enums";

/**
 * P10 — a New Visa product is one NewVisaCountryConfig row: a country +
 * stay duration (30 / 60 days) + Single / Multiple entry. Shared wording
 * for the product selector, the request form and lead details.
 */
export const ENTRY_KIND_LABELS: Record<NewVisaEntryKind, string> = {
  SINGLE: "Single Entry",
  MULTIPLE: "Multiple Entry",
};

export function productStayLabel(config: { stayDays: number | null; duration: string }): string {
  return config.stayDays ? `${config.stayDays} Days` : config.duration;
}

export function productEntryLabel(config: { entryKind: NewVisaEntryKind | null; entryType: string }): string {
  return config.entryKind ? ENTRY_KIND_LABELS[config.entryKind] : config.entryType;
}

export function productLabel(config: { stayDays: number | null; duration: string; entryKind: NewVisaEntryKind | null; entryType: string }): string {
  return `${productStayLabel(config)} · ${productEntryLabel(config)}`;
}

/** P10 defaults (UAE Visa Page Content FINAL §14): Normal needs 7 working days before travel, Express 3. Admin can change them in Timelines / SLA. */
export const DEFAULT_MIN_TRAVEL_DAYS = { normal: 7, urgent: 3 } as const;

export interface NewVisaTravelRules {
  minTravelDaysNormal: number;
  minTravelDaysExpress: number;
}

/** Which processing types can still meet the travel date, given the working days until it. */
export function allowedProcessingTypes(workingDays: number, rules: NewVisaTravelRules): ("normal" | "urgent")[] {
  const allowed: ("normal" | "urgent")[] = [];
  if (workingDays >= rules.minTravelDaysNormal) allowed.push("normal");
  if (workingDays >= rules.minTravelDaysExpress) allowed.push("urgent");
  return allowed;
}
