/** P10 — a passport should stay valid at least this long after the travel date (UAE Visa Page Content FINAL). */
export const PASSPORT_VALIDITY_MONTHS = 6;

/** True when `expiry` ("YYYY-MM-DD") falls before travel date + 6 months. False for a missing/unparseable date. */
export function passportValidityTooShort(expiry: string | null | undefined, travelDate: string | null | undefined): boolean {
  if (!expiry || !travelDate) return false;
  const expiryMs = Date.parse(`${expiry.slice(0, 10)}T00:00:00Z`);
  const travel = new Date(`${travelDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expiryMs) || Number.isNaN(travel.getTime())) return false;
  travel.setUTCMonth(travel.getUTCMonth() + PASSPORT_VALIDITY_MONTHS);
  return expiryMs < travel.getTime();
}
