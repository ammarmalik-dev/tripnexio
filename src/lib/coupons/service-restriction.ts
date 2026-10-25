import { SERVICE_TYPE_LABELS } from "../crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";

// Pure helpers (no DB) so client components and tests can use them too.

/**
 * Admin handover §17 — a coupon's service restriction. An empty list means the
 * coupon is valid for every service. Returns the customer-facing error, or
 * null when the coupon covers `serviceType`.
 */
export function couponServiceError(couponServiceTypes: readonly ServiceType[], serviceType: ServiceType): string | null {
  if (couponServiceTypes.length === 0 || couponServiceTypes.includes(serviceType)) return null;
  return `This code isn't valid for ${SERVICE_TYPE_LABELS[serviceType]}.`;
}

/** "All services" or "New Visa, OTB" — the list label for a coupon's service restriction. */
export function couponServicesLabel(couponServiceTypes: readonly ServiceType[]): string {
  return couponServiceTypes.length === 0 ? "All services" : couponServiceTypes.map((type) => SERVICE_TYPE_LABELS[type]).join(", ");
}

/**
 * The services a coupon can be restricted to in the Admin/CRM pickers. Flight
 * Special Fare is left out because coupons never apply to it
 * (resolveCouponForQuotation), and "Other" has no priced checkout.
 */
export const COUPON_SERVICE_OPTIONS: { value: ServiceType; label: string }[] = (
  ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "RETURN_TICKET", "OTB"] as const
).map((value) => ({ value, label: SERVICE_TYPE_LABELS[value] }));
