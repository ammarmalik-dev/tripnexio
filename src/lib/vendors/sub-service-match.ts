/**
 * Admin handover §12 (client 2026-10-25) — "One vendor can be linked to multiple services and
 * sub-services." A VendorService row lists the SubService codes (of that service) the vendor covers;
 * an empty list means every sub-service. Pure helpers, no DB access (see ./sub-service-scope.ts).
 */

/** SubService.code form: lower-case snake_case (same normalisation as `masterCodeSchema`). */
export function toSubServiceCode(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Lead `details` keys that can carry a sub-service choice (code or a value that maps to one). */
const SUB_SERVICE_DETAIL_KEYS = ["subServiceCode", "subService", "changeType", "visaType", "visaOption"] as const;

/**
 * The SubService codes a lead's details point at, limited to `knownCodes` (every SubService code of
 * the lead's service, active or not). A free-text value that matches no master code is ignored, so a
 * lead without a recognised sub-service returns [] and every vendor of the service qualifies.
 * `idToCode` resolves `details.subServiceId` (SubService.id) when present.
 */
export function leadSubServiceCodes(details: unknown, knownCodes: readonly string[], idToCode?: ReadonlyMap<string, string>): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const record = details as Record<string, unknown>;
  const known = new Set(knownCodes.map(toSubServiceCode));
  const found = new Set<string>();
  for (const key of SUB_SERVICE_DETAIL_KEYS) {
    const value = record[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const code = toSubServiceCode(value);
    if (known.has(code)) found.add(code);
  }
  const subServiceId = record.subServiceId;
  if (typeof subServiceId === "string" && idToCode) {
    const code = idToCode.get(subServiceId);
    if (code && known.has(toSubServiceCode(code))) found.add(toSubServiceCode(code));
  }
  return [...found];
}

/**
 * Whether a vendor's VendorService (its `subServiceCodes`) covers a lead's sub-service(s).
 * Empty vendor list = covers every sub-service; a lead with no sub-service matches every vendor.
 */
export function vendorCoversSubService(vendorCodes: readonly string[], leadCodes: readonly string[]): boolean {
  if (vendorCodes.length === 0 || leadCodes.length === 0) return true;
  const covered = new Set(vendorCodes.map(toSubServiceCode));
  return leadCodes.some((code) => covered.has(toSubServiceCode(code)));
}

/** De-duplicated, normalised codes for saving (keeps only codes of the service's SubService master). */
export function cleanSubServiceCodes(codes: readonly string[], allowedCodes: readonly string[]): { codes: string[]; unknown: string[] } {
  const allowed = new Set(allowedCodes.map(toSubServiceCode));
  const clean = [...new Set(codes.map(toSubServiceCode).filter(Boolean))];
  return { codes: clean.filter((code) => allowed.has(code)).sort(), unknown: clean.filter((code) => !allowed.has(code)) };
}
