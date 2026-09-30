import { z } from "zod";

/**
 * Business Rules §14 "Sensitive Admin Actions" — required flow is
 * "Permission Check → Extra Confirmation → Execute → Audit Log". Every HTTP
 * route that performs one of the locked sensitive actions (refund, vendor
 * change, price change, delete, bulk reassignment, document requirements,
 * GST/tax, workflow/status config, financial adjustments) requires this
 * reason in its request, and folds it into the AuditTrail note via
 * `withReason()`. The reason is only required at the HTTP route layer —
 * automation/system paths that call the same lib functions without a user
 * never need one.
 *
 * Client-safe (no server imports) so the ConfirmActionDialog can share the
 * exact same minimum length.
 */
export const SENSITIVE_REASON_MIN_LENGTH = 5;
export const SENSITIVE_REASON_MAX_LENGTH = 500;

export const sensitiveReasonSchema = z
  .string({ error: "Enter a reason for this action." })
  .trim()
  .min(SENSITIVE_REASON_MIN_LENGTH, `Enter a reason (at least ${SENSITIVE_REASON_MIN_LENGTH} characters).`)
  .max(SENSITIVE_REASON_MAX_LENGTH, `Keep the reason under ${SENSITIVE_REASON_MAX_LENGTH} characters.`);

/** `{ reason }` — extend a route's own body schema with this, or use it on its own for body-less actions. */
export const sensitiveReasonBodySchema = z.object({ reason: sensitiveReasonSchema });

/** Appends the confirmation reason to an audit note, in the one consistent "— reason: …" format. */
export function withReason(note: string, reason: string): string {
  return `${note} — reason: ${reason}`;
}

/** Client helper for DELETE routes — the reason always travels as the `?reason=` query parameter. */
export function withReasonQuery(url: string, reason: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}reason=${encodeURIComponent(reason)}`;
}
