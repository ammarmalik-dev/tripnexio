import type { NextRequest } from "next/server";
import { updateCouponSchema } from "@/lib/validation/coupon-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getEmployeeCouponCap } from "@/lib/settings/coupon-config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateCouponSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Coupon not found.");

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const codeTaken = await db.coupon.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) return jsonError(400, "A coupon with this code already exists.", { code: ["This code is taken."] });
  }

  // updateCouponSchema is a plain .partial() (no cross-field refine), so re-check the merged result here.
  const nextType = parsed.data.type ?? existing.type;
  const nextCategory = parsed.data.category ?? existing.category;
  const nextValue = parsed.data.value ?? Number(existing.value);
  const nextValidFrom = parsed.data.validFrom ? new Date(parsed.data.validFrom) : existing.validFrom;
  const nextValidUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : existing.validUntil;

  if (nextValidUntil <= nextValidFrom) {
    return jsonError(400, "End date must be after the start date.", { validUntil: ["End date must be after the start date."] });
  }
  if (nextType === "PERCENTAGE" && nextValue > 100) {
    return jsonError(400, "A percentage discount can't exceed 100.", { value: ["Can't exceed 100 for a percentage coupon."] });
  }
  if (nextCategory === "EMPLOYEE" && nextType === "FIXED_AMOUNT") {
    const cap = await getEmployeeCouponCap();
    if (nextValue > cap) {
      return jsonError(400, `An Employee coupon's value can't exceed the configured cap (₹${cap}).`, { value: [`Can't exceed ₹${cap}.`] });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.coupon.update({
      where: { id },
      data: {
        ...parsed.data,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : undefined,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
      },
    });
    await writeAudit(tx, {
      entityType: "Coupon",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Coupon "${result.code}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
