import { describe, expect, it } from "vitest";
import { COUPON_SERVICE_OPTIONS, couponServiceError, couponServicesLabel } from "@/lib/coupons/service-restriction";
import { createCouponSchema } from "@/lib/validation/coupon-schema";
import { isAboveApprovalLimit, loadApproverLimit, refundApprovalLimitError } from "@/lib/refunds/approval-limit";

describe("coupon service restriction (Admin handover §17)", () => {
  it("an unrestricted coupon is valid for every service", () => {
    expect(couponServiceError([], "VISA_CHANGE")).toBeNull();
    expect(couponServiceError([], "OTB")).toBeNull();
  });

  it("a restricted coupon is valid only for its services", () => {
    expect(couponServiceError(["NEW_VISA", "OTB"], "OTB")).toBeNull();
    expect(couponServiceError(["NEW_VISA", "OTB"], "VISA_CHANGE")).toBe("This code isn't valid for Visa Change.");
  });

  it("labels the restriction for lists", () => {
    expect(couponServicesLabel([])).toBe("All services");
    expect(couponServicesLabel(["NEW_VISA", "OTB"])).toBe("New Visa, OTB");
  });

  it("does not offer Flight Special Fare in the pickers (coupons never apply there)", () => {
    expect(COUPON_SERVICE_OPTIONS.map((option) => option.value)).not.toContain("FLIGHT_SPECIAL_FARE");
  });

  it("the coupon schema defaults to all services and de-duplicates", () => {
    const base = { code: "save10", type: "PERCENTAGE", category: "EXTERNAL", value: 10, validFrom: "2026-10-01", validUntil: "2026-11-01" };
    const all = createCouponSchema.parse(base);
    expect(all.serviceTypes).toEqual([]);
    const some = createCouponSchema.parse({ ...base, serviceTypes: ["OTB", "OTB", "NEW_VISA"] });
    expect(some.serviceTypes).toEqual(["OTB", "NEW_VISA"]);
    expect(createCouponSchema.safeParse({ ...base, serviceTypes: ["NOT_A_SERVICE"] }).success).toBe(false);
  });
});

describe("refund approval limit (Admin handover §17)", () => {
  it("no limit or admin.full is never limited", () => {
    expect(isAboveApprovalLimit({ limit: null, isAdmin: false, amount: 1_000_000 })).toBe(false);
    expect(isAboveApprovalLimit({ limit: 100, isAdmin: true, amount: 1_000_000 })).toBe(false);
  });

  it("blocks amounts above the limit, allows amounts at or below it", () => {
    expect(isAboveApprovalLimit({ limit: 10000, isAdmin: false, amount: 10000 })).toBe(false);
    expect(isAboveApprovalLimit({ limit: 10000, isAdmin: false, amount: 9999.99 })).toBe(false);
    expect(isAboveApprovalLimit({ limit: 10000, isAdmin: false, amount: 10000.01 })).toBe(true);
    expect(isAboveApprovalLimit({ limit: 0.1 + 0.2, isAdmin: false, amount: 0.3 })).toBe(false);
  });

  it("returns the 403 message only when above the limit", () => {
    expect(refundApprovalLimitError({ limit: 10000, isAdmin: false, amount: 5000 })).toBeNull();
    expect(refundApprovalLimitError({ limit: 10000, isAdmin: false, amount: 12000 })).toBe(
      "This refund is above your approval limit (₹10,000). An admin must approve it."
    );
  });

  it("loads the limit from the user row, skipping the lookup for admin.full", async () => {
    let lookups = 0;
    const client = {
      user: {
        findUnique: async () => {
          lookups++;
          return { refundApprovalLimit: "2500.00" };
        },
      },
    };
    expect(await loadApproverLimit(client, { id: "u1", permissions: ["refunds.approve"] })).toEqual({ limit: 2500, isAdmin: false });
    expect(await loadApproverLimit(client, { id: "u2", permissions: ["admin.full"] })).toEqual({ limit: null, isAdmin: true });
    expect(lookups).toBe(1);
    const noLimit = { user: { findUnique: async () => ({ refundApprovalLimit: null }) } };
    expect(await loadApproverLimit(noLimit, { id: "u3", permissions: [] })).toEqual({ limit: null, isAdmin: false });
  });
});
