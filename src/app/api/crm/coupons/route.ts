import crypto from "crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertOwnsRecord } from "@/lib/auth/ownership";
import { getEmployeeCouponCap } from "@/lib/settings/coupon-config";
import { writeAudit } from "@/lib/audit/log";
import { isFlightQuote } from "@/lib/quotations/pricing";
import { describeError } from "@/lib/api/describe-error";

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

const createSchema = z.object({
  leadReference: z.string().trim().min(3, "Enter the lead reference").max(40),
  amount: z.number().int("Use a whole rupee amount").min(1, "Enter the discount"),
  validDays: z.number().int().min(1).max(30).default(7),
});

/** TN + 6 characters, no look-alikes (0/O, 1/I). */
function newCouponCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `TN${Array.from(crypto.randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

/**
 * Client testing 2026-10-09 (E3) — staff create a coupon for one of their
 * leads without Admin approval, up to the Admin-set employee cap (₹500 by
 * default, Admin → Coupons): a fixed ₹ discount, single use, valid only on
 * that lead, audited. Anything above the cap still needs Admin → Coupons.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { leadReference, amount, validDays } = parsed.data;

  try {
    const cap = await getEmployeeCouponCap();
    if (amount > cap) {
      return jsonError(400, `Staff coupons can be up to ₹${cap.toLocaleString("en-IN")}. Ask Admin for a bigger discount.`, { amount: [`Max ₹${cap}`] });
    }
    const lead = await db.lead.findFirst({
      where: { reference: { equals: leadReference, mode: "insensitive" } },
      select: { id: true, reference: true, serviceType: true, assignedStaffId: true },
    });
    if (!lead) return jsonError(404, "No lead found with that reference.", { leadReference: ["Not found"] });
    const scopeError = assertServiceAccess(session, lead.serviceType);
    if (scopeError) return scopeError;
    const ownershipError = assertOwnsRecord(session, lead.assignedStaffId);
    if (ownershipError) return ownershipError;
    if (isFlightQuote(lead.serviceType)) return jsonError(400, "Coupons don't apply to Flight Special Fare.");

    const now = new Date();
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const coupon = await db.$transaction(async (tx) => {
          const created = await tx.coupon.create({
            data: {
              code: newCouponCode(),
              type: "FIXED_AMOUNT",
              value: amount,
              maxDiscount: amount,
              category: "EMPLOYEE",
              validFrom: now,
              validUntil,
              usageLimit: 1,
              leadId: lead.id,
            },
          });
          await writeAudit(tx, {
            entityType: "Coupon",
            entityId: created.id,
            action: "CREATE",
            byUserId: session.id,
            note: `Staff coupon ${created.code}: ₹${amount} off, single use, lead ${lead.reference ?? lead.id}, valid ${validDays} day(s) (by ${session.name})`,
          });
          await writeAudit(tx, {
            entityType: "Lead",
            entityId: lead.id,
            action: "COUPON_CREATED",
            byUserId: session.id,
            note: `Coupon ${created.code} (₹${amount} off) created for this lead (by ${session.name})`,
          });
          return created;
        });
        return jsonSuccess({ code: coupon.code, amount, validUntil: coupon.validUntil.toISOString(), leadReference: lead.reference }, 201);
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
      }
    }
    return jsonError(500, "Couldn't create a unique coupon code. Please try again.");
  } catch (error) {
    console.error("[api/crm/coupons] POST", describeError(error));
    return jsonError(500, "Couldn't create the coupon.");
  }
}
