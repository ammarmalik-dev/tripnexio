import { db } from "../db";
import { getEmployeeCouponCap } from "../settings/coupon-config";
import { isFlightQuote } from "../quotations/pricing";
import type { ServiceType } from "../../generated/prisma/enums";

export interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discountAmount: number;
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
 * own category is EMPLOYEE. Returns a plain error string on any failure
 * rather than throwing, so callers (the Quotation POST/PATCH routes) can
 * surface it as a normal field-level validation error.
 */
export async function resolveCouponForQuotation(
  code: string,
  serviceType: ServiceType,
  sellingPrice: number
): Promise<{ ok: true; coupon: AppliedCoupon } | { ok: false; error: string }> {
  if (isFlightQuote(serviceType)) {
    return { ok: false, error: "Coupons don't apply to Flight Special Fare quotes — CRM.md §10 prices these separately." };
  }

  const normalizedCode = code.trim().toUpperCase();
  const coupon = await db.coupon.findUnique({ where: { code: normalizedCode } });
  if (!coupon) return { ok: false, error: "No coupon found with this code." };
  if (!coupon.active) return { ok: false, error: "This coupon is disabled." };

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    return { ok: false, error: "This coupon isn't within its valid date range." };
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, error: "This coupon has reached its usage limit." };
  }

  let discountAmount = coupon.type === "PERCENTAGE" ? sellingPrice * (Number(coupon.value) / 100) : Number(coupon.value);

  if (coupon.category === "EMPLOYEE") {
    const cap = await getEmployeeCouponCap();
    discountAmount = Math.min(discountAmount, cap);
  }

  // A discount can never exceed the total it's being applied to.
  discountAmount = Math.min(discountAmount, sellingPrice);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return { ok: true, coupon: { couponId: coupon.id, couponCode: coupon.code, discountAmount } };
}
