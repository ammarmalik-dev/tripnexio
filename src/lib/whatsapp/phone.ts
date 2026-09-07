/**
 * WhatsApp Cloud API's `to` field wants digits only, with country code, no
 * `+`/spaces/dashes (e.g. "919876543210") — `Customer.mobile` is stored
 * however the customer typed it (the shared regex `/^\+?[0-9\s-]{7,15}$/`
 * allows `+91 98765 43210`, `9876543210`, etc.). Strips non-digits and, for
 * a bare 10-digit number (no country code), assumes India — this project's
 * locked market is India-origin only (see CLAUDE.md Scope).
 */
export function toWhatsAppId(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
