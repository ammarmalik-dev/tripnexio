interface NationalityRuleFields {
  nationalityId: string | null;
  /** Legacy/display name, kept on rows alongside `nationalityId`. */
  nationality: string | null;
}

interface PassengerNationality {
  nationalityId?: string | null;
  nationality: string | null;
}

/** A rule with neither an id nor a name applies to every nationality. */
export function isUniversalNationalityRule(rule: NationalityRuleFields): boolean {
  return !rule.nationalityId && !rule.nationality;
}

/**
 * Does a nationality-specific PricingRule/DocumentRequirement row target this
 * passenger? Matched on the Nationality master id when both sides have one
 * (P06); otherwise on the name, case-insensitively, so rows and passengers
 * created before the master existed keep matching.
 */
export function matchesNationality(rule: NationalityRuleFields, passenger: PassengerNationality): boolean {
  if (isUniversalNationalityRule(rule)) return false;
  if (rule.nationalityId && passenger.nationalityId) return rule.nationalityId === passenger.nationalityId;
  const ruleName = rule.nationality?.trim().toLowerCase();
  const passengerName = passenger.nationality?.trim().toLowerCase();
  return !!ruleName && ruleName === passengerName;
}
