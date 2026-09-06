import type { NextRequest } from "next/server";
import { createCouponSchema } from "@/lib/validation/coupon-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return jsonSuccess(coupons);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createCouponSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return jsonError(400, "A coupon with this code already exists.", { code: ["This code is taken."] });
  }

  const coupon = await db.$transaction(async (tx) => {
    const created = await tx.coupon.create({
      data: {
        code: parsed.data.code,
        type: parsed.data.type,
        value: parsed.data.value,
        validFrom: new Date(parsed.data.validFrom),
        validUntil: new Date(parsed.data.validUntil),
        usageLimit: parsed.data.usageLimit,
        active: parsed.data.active,
      },
    });
    await writeAudit(tx, {
      entityType: "Coupon",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Coupon "${created.code}" created — ${created.type === "PERCENTAGE" ? `${created.value}%` : `₹${created.value}`} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(coupon, 201);
}
