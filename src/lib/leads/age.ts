/** New Visa handover: anyone under 18 is a minor and must apply with a parent/guardian. */
export const MINOR_AGE_LIMIT = 18;

/** Whole years between `dob` (YYYY-MM-DD) and `on` (defaults to today). Returns null for an unparseable date. */
export function ageInYears(dob: string, on: Date = new Date()): number | null {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  let age = on.getFullYear() - birth.getFullYear();
  const monthDiff = on.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * The one date New Visa ages are measured on (P06): the travel date when
 * it's a real date, today otherwise. The under-18 guardian rule and the
 * Adult/Child/Infant passenger type both use it, so they can't disagree.
 */
export function ageBasisDate(travelDate: string | undefined): Date {
  if (travelDate) {
    const parsed = new Date(travelDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function isMinor(dob: string | undefined, on: Date = new Date()): boolean {
  if (!dob) return false;
  const age = ageInYears(dob, on);
  return age !== null && age < MINOR_AGE_LIMIT;
}
