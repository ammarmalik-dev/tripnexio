import { describe, expect, it } from "vitest";
import {
  compareInvoices,
  financialYearOf,
  financialYearOptions,
  financialYearRange,
  invoiceNumberPrefix,
  invoiceRefundState,
  isValidFinancialYear,
} from "@/lib/invoices/invoice-filters";
import { invoiceQuerySchema } from "@/lib/invoices/invoice-query";

const IST = 330;

describe("invoiceRefundState", () => {
  it("is none with no completed refund", () => {
    expect(invoiceRefundState(1180, 0)).toBe("none");
    expect(invoiceRefundState(1180, 0.001)).toBe("none");
  });
  it("is partial below the total", () => {
    expect(invoiceRefundState(1180, 500)).toBe("partial");
    expect(invoiceRefundState(1180, 1179.98)).toBe("partial");
  });
  it("is full at (or within half a paisa of) the total", () => {
    expect(invoiceRefundState(1180, 1180)).toBe("full");
    expect(invoiceRefundState(1180, 1179.996)).toBe("full");
  });
});

describe("financial year helpers", () => {
  it("validates labels", () => {
    expect(isValidFinancialYear("2026-27")).toBe(true);
    expect(isValidFinancialYear("2099-00")).toBe(true);
    expect(isValidFinancialYear("2026-28")).toBe(false);
    expect(isValidFinancialYear("26-27")).toBe(false);
  });

  it("derives the FY in local time", () => {
    // 31 Mar 2026 20:00 UTC is 1 Apr 2026 01:30 IST — already FY 2026-27.
    expect(financialYearOf(new Date("2026-03-31T20:00:00Z"), IST)).toBe("2026-27");
    expect(financialYearOf(new Date("2026-03-31T18:00:00Z"), IST)).toBe("2025-26");
    expect(financialYearOf(new Date("2027-01-15T00:00:00Z"), IST)).toBe("2026-27");
  });

  it("gives the [1 Apr, next 1 Apr) range in local time", () => {
    const { start, end } = financialYearRange("2026-27", IST);
    expect(start.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2027-03-31T18:30:00.000Z");
  });

  it("matches the invoice-number prefix", () => {
    expect("INV-2026-27-0001".startsWith(invoiceNumberPrefix("2026-27"))).toBe(true);
  });

  it("lists the current FY first", () => {
    expect(financialYearOptions(new Date("2026-10-01T06:00:00Z"), IST, 3)).toEqual(["2026-27", "2025-26", "2024-25"]);
  });
});

describe("compareInvoices", () => {
  const rows = [
    { id: "b", issuedAt: new Date("2026-05-01"), total: 100 },
    { id: "a", issuedAt: new Date("2026-06-01"), total: 300 },
    { id: "c", issuedAt: new Date("2026-05-01"), total: 200 },
  ];
  it("sorts by date with an id tie-break", () => {
    expect([...rows].sort(compareInvoices("date_desc")).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect([...rows].sort(compareInvoices("date_asc")).map((row) => row.id)).toEqual(["b", "c", "a"]);
  });
  it("sorts by total", () => {
    expect([...rows].sort(compareInvoices("total_desc")).map((row) => row.id)).toEqual(["a", "c", "b"]);
    expect([...rows].sort(compareInvoices("total_asc")).map((row) => row.id)).toEqual(["b", "c", "a"]);
  });
});

describe("invoiceQuerySchema", () => {
  it("defaults and treats empty params as unset", () => {
    const parsed = invoiceQuerySchema.parse({ method: "", search: "  ", sort: "" });
    expect(parsed).toMatchObject({ sort: "date_desc", page: 1, pageSize: 10 });
    expect(parsed.method).toBeUndefined();
    expect(parsed.search).toBeUndefined();
  });
  it("rejects a page size over 100 and a bad FY", () => {
    expect(invoiceQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(invoiceQuerySchema.safeParse({ financialYear: "2026-30" }).success).toBe(false);
  });
});
