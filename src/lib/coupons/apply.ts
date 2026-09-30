import { db } from "../db";
import { getEmployeeCouponCap } from "../settings/coupon-config";
import { isFlightQuote } from "../quotations/pricing";
import type { CouponType, ServiceType } from "../../generated/prisma/enums";

export interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discountAmount: number;
}

/**
 * P24 — the raw discount a coupon gives on `amount`, before the Employee cap
 * and the "never more than the total" clamp. PERCENTAGE: min(percent ×
 * amount, maxDiscount). FIXED_AMOUNT: the value itself, capped by
 * maxDiscount only when that is set lower than the value.
 */
export function computeCouponDiscount(coupon: { type: CouponType; value: number; maxDiscount: number | null }, amount: number): number {
  const raw = coupon.type === "PERCENTAGE" ? amount * (coupon.value / 100) : coupon.value;
  return coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
}

/**
 * CRM.md §10's pricing formula ("...− Coupon + Gateway Charge = Customer
 * Payable") only applies to Visa/Visa Change/Visa Extension/OTB — Flight
 * Special Fare gets its own formula in the same section with no coupon
 * term at all, so a coupon code is rejected outright for a flight quote
 * rather than silently ignored.
 *
 * Validates "active, within date range, under usage limit" per the
 * roadmap prompt's own explicit list, then computes the discount amount —
 * clamped so it can never exceed the quote total, and further clamped to
 * the Admin-configured employeeCouponCap (ADMIN.md §25) when the coupon's
 * own category is EMPLOYEE, and (P24) to the coupon's own maxDiscount. A
 * lead-scoped coupon (Coupon.leadId) is rejected on any other lead.
 * Returns a plain error string on any failure rather than throwing, so callers (the Quotation POST/PATCH routes) can
 * surface it as a normal field-level validation error.
 */
export async function resolveCouponForQuotation(
  code: string,
  serviceType: ServiceType,
  sellingPrice: number,
  /** P24 — the lead the quotation belongs to; a lead-scoped coupon (Coupon.leadId set, e.g. an abandoned-quotation coupon) only redeems on that lead. */
  leadId: string
): Promise<{ ok: true; coupon: AppliedCoupon } | { ok: false; error: string }> {
  if (isFlightQuote(serviceType)) {
    return { ok: false, error: "Coupons don't apply to Flight Special Fare quotes." };
  }

  const normalizedCode = code.trim().toUpperCase();
  const coupon = await db.coupon.findUnique({ where: { code: normalizedCode } });
  // P24 — a coupon issued for one specific lead can't be used anywhere else.
  // Same message as "not found" so a code can't be probed for its owner.
  if (!coupon || (coupon.leadId != null && coupon.leadId !== leadId)) {
    return { ok: false, error: "No coupon found with this code." };
  }
  if (!coupon.active) return { ok: false, error: "This coupon is disabled." };

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    return { ok: false, error: "This coupon isn't within its valid date range." };
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, error: "This coupon has reached its usage limit." };
  }

  let discountAmount = computeCouponDiscount(
    { type: coupon.type, value: Number(coupon.value), maxDiscount: coupon.maxDiscount == null ? null : Number(coupon.maxDiscount) },
    sellingPrice
  );

  if (coupon.category === "EMPLOYEE") {
    const cap = await getEmployeeCouponCap();
    discountAmount = Math.min(discountAmount, cap);
  }

  // A discount can never exceed the total it's being applied to.
  discountAmount = Math.min(discountAmount, sellingPrice);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return { ok: true, coupon: { couponId: coupon.id, couponCode: coupon.code, discountAmount } };
}
