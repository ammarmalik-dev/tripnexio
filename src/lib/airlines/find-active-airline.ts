import { db } from "../db";

/**
 * Validates a submitted airline `code` against the shared, Admin-managed
 * Airline master (§9, Admin FINAL handover — "one common airline list for
 * all applicable services") — the same server-side re-validation pattern
 * OTB's own lead-intake route already uses (never trust the client's code
 * string blindly). Returns the matched row, or null if it doesn't match an
 * active airline. Deliberately does NOT filter on `otbRequired` — that flag
 * is OTB-specific ("does this airline require the OTB service"), not a
 * general "is this airline usable at all" gate.
 */
export async function findActiveAirlineByCode(code: string) {
  return db.airline.findFirst({ where: { code, active: true } });
}
