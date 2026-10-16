import type { StatusScope, LeadStatus, BookingStatus } from "../../generated/prisma/enums";
import { CUSTOMER_LEAD_STATUS_LABELS, CUSTOMER_BOOKING_STATUS_LABELS } from "../account/labels";

/**
 * Customer-safe status wording (CRM.md §14): the status's Admin-editable
 * customerLabel when set, otherwise the existing customer wording for the
 * coarse lifecycle status — never an internal status name.
 */
export function customerStatusLabel(
  scope: StatusScope,
  serviceStatus: { customerLabel: string | null; name?: string | null } | null | undefined,
  coarse: LeadStatus | BookingStatus
): string {
  const label = serviceStatus?.customerLabel?.trim();
  if (label) return label;
  // Client doc 2026-10-15 (I3) — a rejection reads "Rejected", never the coarse "Cancelled".
  if (serviceStatus?.name && /reject/i.test(serviceStatus.name)) return "Rejected";
  return scope === "LEAD" ? CUSTOMER_LEAD_STATUS_LABELS[coarse as LeadStatus] : CUSTOMER_BOOKING_STATUS_LABELS[coarse as BookingStatus];
}
