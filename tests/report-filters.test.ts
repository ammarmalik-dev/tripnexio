import { describe, expect, it } from "vitest";
import { bookingLevelWhere, hasRecordScope, parseSubServiceFilter, subServiceLeadWhere } from "../src/lib/reports/scope";
import { parseReportQuery, restrictFilters } from "../src/lib/reports/query";
import { SCOPE_FILTERS, UNPAID_REPORT_FILTERS } from "../src/lib/reports/types";

describe("report filters (Admin handover §15)", () => {
  it("parses sub-service, status and payment status from the query string", () => {
    const parsed = parseReportQuery(
      new URLSearchParams({ from: "2026-10-01", to: "2026-10-10", subService: "VISA_CHANGE:border_exit", bookingStatus: "COMPLETED", leadStatus: "LOST", paymentStatus: "REFUNDED" })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.filters).toMatchObject({ subService: "VISA_CHANGE:border_exit", bookingStatus: "COMPLETED", leadStatus: "LOST", paymentStatus: "REFUNDED" });
    expect(parseReportQuery(new URLSearchParams({ paymentStatus: "MAYBE" })).ok).toBe(false);
    expect(parseReportQuery(new URLSearchParams({ subService: "not valid" })).ok).toBe(false);
  });

  it("drops filters a report doesn't support", () => {
    const filters = { from: new Date(0), to: new Date(1), paymentStatus: "PAID" as const, bookingStatus: "PENDING" as const, leadStatus: "NEW" as const };
    expect(restrictFilters(filters, UNPAID_REPORT_FILTERS)).toEqual({ from: filters.from, to: filters.to, bookingStatus: "PENDING" });
    expect(restrictFilters(filters, SCOPE_FILTERS)).toEqual({ from: filters.from, to: filters.to, bookingStatus: "PENDING", paymentStatus: "PAID" });
  });

  it("builds booking-level conditions", () => {
    expect(bookingLevelWhere({})).toEqual([]);
    expect(bookingLevelWhere({ bookingStatus: "CANCELLED", paymentStatus: "PAID" })).toEqual([
      { status: "CANCELLED" },
      { payments: { some: { status: "SUCCESS" } } },
    ]);
    expect(bookingLevelWhere({ paymentStatus: "UNPAID" })).toEqual([{ payments: { none: { status: "SUCCESS" } } }]);
    expect(bookingLevelWhere({ paymentStatus: "REFUNDED" })).toEqual([{ payments: { some: { refunds: { some: { status: "COMPLETED" } } } } }]);
  });

  it("matches a sub-service by service plus code / name / id in the lead details", () => {
    expect(parseSubServiceFilter("VISA_CHANGE:border_exit")).toEqual({ serviceType: "VISA_CHANGE", code: "border_exit" });
    expect(parseSubServiceFilter("NOPE:x")).toBeNull();
    expect(parseSubServiceFilter("VISA_CHANGE:")).toBeNull();
    const where = subServiceLeadWhere({ id: "ss1", serviceType: "VISA_CHANGE", code: "border_exit", name: "Border Exit" });
    const and = where.AND as Record<string, unknown>[];
    expect(and[0]).toEqual({ serviceType: "VISA_CHANGE" });
    const or = (and[1] as { OR: unknown[] }).OR;
    expect(or).toContainEqual({ details: { path: ["subServiceId"], equals: "ss1" } });
    expect(or).toContainEqual({ details: { path: ["changeType"], equals: "BORDER_EXIT" } });
    expect(or).toContainEqual({ details: { path: ["visaType"], equals: "Border Exit" } });
  });

  it("knows when a report is narrowed to records", () => {
    expect(hasRecordScope({ from: new Date(0), to: new Date(1) })).toBe(false);
    expect(hasRecordScope({ from: new Date(0), to: new Date(1), paymentStatus: "UNPAID" })).toBe(true);
  });
});
