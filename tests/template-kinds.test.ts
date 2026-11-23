import { describe, expect, it } from "vitest";
import { templateKindFor, templateStageFor } from "../src/lib/notifications/template-kinds";

const usage = {
  statuses: [
    { event: "NV_NEW", name: "New", scope: "LEAD", stage: "BEFORE_PAYMENT" as const },
    { event: "NV_PAID", name: "Paid", scope: "BOOKING", stage: "AFTER_PAYMENT" as const },
    { event: "NV_DOCS", name: "Documents Pending", scope: "BOOKING", stage: "AFTER_PAYMENT" as const },
    { event: "NV_APPLIED", name: "Applied to Embassy", scope: "BOOKING", stage: "AFTER_PAYMENT" as const },
  ],
};

describe("template kinds (M4)", () => {
  it("classifies reminders, upsells, coupons, submission, payment, documents and status messages", () => {
    expect(templateKindFor("DOCUMENT_REMINDER", usage)).toBe("REMINDER");
    expect(templateKindFor("OTB_UPSELL", usage)).toBe("UPSELL");
    expect(templateKindFor("ABANDONED_QUOTE_COUPON", usage)).toBe("COUPON");
    expect(templateKindFor("NV_NEW", usage)).toBe("SUBMISSION");
    expect(templateKindFor("NV_PAID", usage)).toBe("PAYMENT");
    expect(templateKindFor("NV_DOCS", usage)).toBe("DOCUMENTS");
    expect(templateKindFor("NV_APPLIED", usage)).toBe("STATUS");
    expect(templateKindFor("ENQUIRY_RECEIVED", usage)).toBe("GENERAL");
  });
  it("knows the payment stage", () => {
    expect(templateStageFor("NV_NEW", usage)).toBe("BEFORE_PAYMENT");
    expect(templateStageFor("NV_APPLIED", usage)).toBe("AFTER_PAYMENT");
    expect(templateStageFor("ENQUIRY_RECEIVED", usage)).toBeNull();
  });
});
