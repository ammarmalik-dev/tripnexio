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

export function isMinor(dob: string | undefined, on: Date = new Date()): boolean {
  if (!dob) return false;
  const age = ageInYears(dob, on);
  return age !== null && age < MINOR_AGE_LIMIT;
}
