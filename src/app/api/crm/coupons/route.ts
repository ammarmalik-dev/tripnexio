import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * Client corrections 2026-10-05 — coupons staff may apply in the CRM: active,
 * currently valid, under their usage limit, and not tied to one lead (the
 * abandoned-quotation coupons are). Codes are created and edited in Admin →
 * Coupons; the quote builder still validates every code on save.
 */
export async function GET() {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: { active: true, leadId: null, validFrom: { lte: now }, validUntil: { gte: now } },
    orderBy: [{ validUntil: "asc" }],
    select: { id: true, code: true, type: true, category: true, value: true, maxDiscount: true, validUntil: true, usageLimit: true, usageCount: true },
  });
  return jsonSuccess(coupons.filter((coupon) => coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit));
}
