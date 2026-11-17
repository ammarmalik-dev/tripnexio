import type { NextRequest } from "next/server";
import { createCouponSchema } from "@/lib/validation/coupon-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getEmployeeCouponCap } from "@/lib/settings/coupon-config";
import { couponServicesLabel } from "@/lib/coupons/service-restriction";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  // Client doc 16 Nov (I11) — tracking: who created it, and who used it when (with the booking's POC).
  const [creators, uses] = await Promise.all([
    db.user.findMany({ where: { id: { in: [...new Set(coupons.map((coupon) => coupon.createdByUserId).filter((id): id is string => !!id))] } }, select: { id: true, name: true } }),
    db.payment.findMany({
      where: { couponId: { in: coupons.map((coupon) => coupon.id) }, status: "SUCCESS" },
      orderBy: { updatedAt: "desc" },
      select: {
        couponId: true,
        updatedAt: true,
        booking: { select: { bookingId: true, customer: { select: { name: true } }, lead: { select: { assignedStaff: { select: { name: true } } } } } },
      },
    }),
  ]);
  return jsonSuccess(
    coupons.map((coupon) => {
      const lastUse = uses.find((use) => use.couponId === coupon.id);
      return {
        ...coupon,
        createdByName: creators.find((user) => user.id === coupon.createdByUserId)?.name ?? (coupon.createdByUserId ? null : "System"),
        lastUse: lastUse
          ? {
              at: lastUse.updatedAt,
              bookingId: lastUse.booking.bookingId,
              customerName: lastUse.booking.customer.name,
              poc: lastUse.booking.lead.assignedStaff?.name ?? null,
            }
          : null,
      };
    })
  );
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

  // ADMIN.md §25 (Step 22) — a fixed-amount Employee coupon can't even be
  // CREATED above the configured cap (a percentage-type one is checked at
  // apply-time instead, since its actual discount depends on the quote
  // total — see src/lib/coupons/apply.ts).
  if (parsed.data.category === "EMPLOYEE" && parsed.data.type === "FIXED_AMOUNT") {
    const cap = await getEmployeeCouponCap();
    if (parsed.data.value > cap) {
      return jsonError(400, `An Employee coupon's value can't exceed the configured cap (₹${cap}).`, { value: [`Can't exceed ₹${cap}.`] });
    }
  }

  const coupon = await db.$transaction(async (tx) => {
    const created = await tx.coupon.create({
      data: {
        createdByUserId: session.id,
        code: parsed.data.code,
        type: parsed.data.type,
        category: parsed.data.category,
        value: parsed.data.value,
        validFrom: new Date(parsed.data.validFrom),
        validUntil: new Date(parsed.data.validUntil),
        usageLimit: parsed.data.usageLimit,
        maxDiscount: parsed.data.maxDiscount ?? null,
        active: parsed.data.active,
        serviceTypes: parsed.data.serviceTypes,
      },
    });
    await writeAudit(tx, {
      entityType: "Coupon",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Coupon "${created.code}" created — ${created.type === "PERCENTAGE" ? `${created.value}%` : `₹${created.value}`}${created.maxDiscount != null ? `, max discount ₹${created.maxDiscount}` : ""}, valid for ${couponServicesLabel(created.serviceTypes)} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(coupon, 201);
}
