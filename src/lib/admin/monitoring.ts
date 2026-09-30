/**
 * P24 items 7/8 — small shared helpers for the read-only Admin monitoring
 * screens (Audit Log, Configuration History, OCR Monitor, Live Activity).
 * Plain functions with no DB/Node imports, so both route handlers and
 * client components can use them.
 */

/**
 * CRM/Admin screen that shows a given audited entity, when one exists.
 * Only entity types with a real per-record page (or a list screen that is
 * the record's home) get a link; everything else renders as plain text.
 */
export function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Lead":
      return `/crm/leads/${entityId}`;
    case "Booking":
      return `/crm/bookings/${entityId}`;
    case "Customer":
      return `/crm/customers/${entityId}`;
    default:
      return null;
  }
}

/**
 * Masks a WhatsApp id / phone number for display on a shared monitoring
 * screen: keeps the first 2 digits (country code hint) and the last 4.
 */
export function maskPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 6) return "•".repeat(Math.max(0, digits.length - 2)) + digits.slice(-2);
  return `+${digits.slice(0, 2)} ${"•".repeat(digits.length - 6)} ${digits.slice(-4)}`;
}

/**
 * Configuration entities whose AuditTrail rows make up Admin →
 * Configuration History — every Admin-editable master/config model (the
 * "entityType" string each Admin route writes). Pricing rules and vendor
 * service rates additionally have their own structured history tables
 * (PricingRuleHistory / VendorRateHistory), merged in by the route.
 * A type in this list that no route has ever audited simply yields no rows.
 */
export const CONFIG_ENTITY_TYPES = [
  "SystemConfig",
  "TaxFeeConfig",
  "InvoiceConfig",
  "CouponConfig",
  "Coupon",
  "PaymentGatewayConfig",
  "PricingRule",
  "OtbPrice",
  "OtbRuleConfig",
  "RefundConfig",
  "ProtectionPlanConfig",
  "ProtectionPlanCountry",
  "VendorScoringConfig",
  "Service",
  "SubService",
  "ServiceStatus",
  "ServiceStatusTransition",
  "ServiceTerms",
  "ServiceTimelineConfig",
  "ProcessingTypeOption",
  "DocumentRequirement",
  "NewVisaCountryConfig",
  "ReturnTicketDestination",
  "VisaType",
  "Country",
  "Nationality",
  "Occupation",
  "Airline",
  "Airport",
  "Border",
  "Holiday",
  "Vendor",
  "Faq",
  "NotificationTemplate",
  "ExpenseCategory",
  "AssignmentRule",
  "EscalationRule",
  "Role",
] as const;

export type ConfigEntityType = (typeof CONFIG_ENTITY_TYPES)[number];

export function isConfigEntityType(value: string): value is ConfigEntityType {
  return (CONFIG_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Passport OCR is the only type the existing re-run endpoint (POST /api/documents/[id]/run-ocr) can retry. */
export function canRetryPassportOcr(document: { type: string; fileUrl: string | null; passengerId: string | null }): boolean {
  return /passport/i.test(document.type) && Boolean(document.fileUrl) && Boolean(document.passengerId);
}

/** "30 Sept, 14:05" style timestamp used across the monitoring screens. */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
