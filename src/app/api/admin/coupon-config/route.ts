import type { NextRequest } from "next/server";
import { updateCouponConfigSchema } from "@/lib/validation/coupon-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { COUPON_CONFIG_ID } from "@/lib/settings/coupon-config";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const config = await db.couponConfig.findUnique({ where: { id: COUPON_CONFIG_ID } });
  if (!config) return jsonError(404, "Coupon configuration not found — run the seed script.");

  return jsonSuccess(config);
}

function describe(value: unknown): string {
  return value === null || value === undefined ? "not set" : String(value);
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateCouponConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.couponConfig.findUnique({ where: { id: COUPON_CONFIG_ID } });
  if (!existing) return jsonError(404, "Coupon configuration not found — run the seed script.");

  // P24 — cross-field checks against the merged (existing + incoming) values.
  const data = parsed.data;
  const merged = {
    enabled: data.abandonedCouponEnabled ?? existing.abandonedCouponEnabled,
    afterHours: data.abandonedAfterHours !== undefined ? data.abandonedAfterHours : existing.abandonedAfterHours,
    type: data.abandonedCouponType !== undefined ? data.abandonedCouponType : existing.abandonedCouponType,
    value:
      data.abandonedCouponValue !== undefined
        ? data.abandonedCouponValue
        : existing.abandonedCouponValue == null
          ? null
          : Number(existing.abandonedCouponValue),
    validDays: data.abandonedCouponValidDays !== undefined ? data.abandonedCouponValidDays : existing.abandonedCouponValidDays,
  };
  if (merged.type === "PERCENTAGE" && merged.value != null && merged.value > 100) {
    return jsonError(400, "A percentage discount can't exceed 100.", { abandonedCouponValue: ["Can't exceed 100 for a percentage coupon."] });
  }
  if (merged.enabled) {
    const missing: Record<string, string[]> = {};
    if (merged.type == null) missing.abandonedCouponType = ["Required to enable the automation."];
    if (merged.value == null) missing.abandonedCouponValue = ["Required to enable the automation."];
    if (merged.afterHours == null) missing.abandonedAfterHours = ["Required to enable the automation."];
    if (merged.validDays == null) missing.abandonedCouponValidDays = ["Required to enable the automation."];
    if (Object.keys(missing).length > 0) {
      return jsonError(400, "Set the coupon type, value, hours and validity before enabling the automation.", missing);
    }
  }

  const changes: string[] = [];
  const track = (label: string, before: unknown, after: unknown) => {
    if (after !== undefined && describe(before) !== describe(after)) changes.push(`${label}: ${describe(before)} -> ${describe(after)}`);
  };
  track("Employee coupon cap (₹)", existing.employeeCouponCap, data.employeeCouponCap);
  track("Abandoned-quotation coupon enabled", existing.abandonedCouponEnabled, data.abandonedCouponEnabled);
  track("after (hours)", existing.abandonedAfterHours, data.abandonedAfterHours);
  track("type", existing.abandonedCouponType, data.abandonedCouponType);
  track("value", existing.abandonedCouponValue, data.abandonedCouponValue);
  track("max discount (₹)", existing.abandonedCouponMaxDiscount, data.abandonedCouponMaxDiscount);
  track("valid (days)", existing.abandonedCouponValidDays, data.abandonedCouponValidDays);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.couponConfig.update({ where: { id: COUPON_CONFIG_ID }, data });
    await writeAudit(tx, {
      entityType: "CouponConfig",
      entityId: COUPON_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `Coupon configuration updated${changes.length > 0 ? ` — ${changes.join("; ")}` : " (no changes)"} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
