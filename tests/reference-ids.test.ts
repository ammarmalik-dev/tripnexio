import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";

// The reference/invoice modules import the global Prisma client (via
// system-config); these tests never touch a database — every DB call goes
// through the fake transaction client below instead.
vi.mock("@/lib/db", () => ({ db: {} }));

import { formatReference, leadReference, nextLeadReference, parseLeadReference, referencePeriod } from "@/lib/leads/reference";
import { financialYear, nextInvoiceNumber } from "@/lib/invoices/invoice-number";
import { bookingIdForLead } from "@/lib/bookings/reference";

const IST = 330;

/**
 * In-memory stand-in for the transaction client. The real sequencing is a
 * single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on
 * ReferenceCounter / InvoiceCounter — that concurrency guarantee is
 * Postgres-bound and not testable here. This fake models it as an atomic
 * per-key counter, so the tests cover everything the TypeScript does around
 * it: period / financial-year keying, formatting, padding and rollover.
 */
function fakeTx(options: { timezoneOffsetMinutes?: number | null; serviceReferenceCode?: string; takenBookingIds?: string[] } = {}) {
  const counters = new Map<string, number>();
  const tx = {
    systemConfig: {
      findUnique: async () => (options.timezoneOffsetMinutes == null ? null : { timezoneOffsetMinutes: options.timezoneOffsetMinutes }),
    },
    service: {
      findUnique: async () => (options.serviceReferenceCode === undefined ? null : { referenceCode: options.serviceReferenceCode }),
    },
    booking: {
      findMany: async () => (options.takenBookingIds ?? []).map((bookingId) => ({ bookingId })),
    },
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = String(values[0]);
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return [{ lastValue: next }];
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, counters };
}

describe("lead reference format", () => {
  it("derives the MMYY period in the configured timezone", () => {
    expect(referencePeriod(new Date("2026-09-15T12:00:00Z"), IST)).toBe("0926");
    // 20:00Z on Sep 30 is already Oct 1 in IST.
    expect(referencePeriod(new Date("2026-09-30T20:00:00Z"), IST)).toBe("1026");
    expect(referencePeriod(new Date("2026-09-30T20:00:00Z"), 0)).toBe("0926");
    expect(referencePeriod(new Date("2026-12-31T19:00:00Z"), IST)).toBe("0127");
  });

  it("formats 1 + MMYY + service code + a zero-padded (min 3 digit) sequence", () => {
    expect(formatReference("0926", "VI", 1)).toBe("10926VI001");
    expect(formatReference("0926", "OT", 42)).toBe("10926OT042");
    expect(formatReference("0926", "FL", 999)).toBe("10926FL999");
    expect(formatReference("0926", "FL", 1234)).toBe("10926FL1234");
  });
});

describe("nextLeadReference (per-month sequence)", () => {
  const now = new Date("2026-09-15T06:00:00Z");

  it("uses the Service row's reference code, else the built-in fallback", async () => {
    expect(await nextLeadReference(fakeTx({ timezoneOffsetMinutes: IST, serviceReferenceCode: "VX" }).tx, "NEW_VISA", now)).toBe("10926VX001");
    expect(await nextLeadReference(fakeTx({ timezoneOffsetMinutes: IST }).tx, "NEW_VISA", now)).toBe("10926VI001");
    expect(await nextLeadReference(fakeTx({ timezoneOffsetMinutes: IST }).tx, "RETURN_TICKET", now)).toBe("10926RT001");
  });

  it("falls back to IST when no SystemConfig row exists", async () => {
    const { tx } = fakeTx({ timezoneOffsetMinutes: null });
    expect(await nextLeadReference(tx, "OTB", new Date("2026-09-30T20:00:00Z"))).toBe("11026OT001");
  });

  it("shares one monthly sequence across every service", async () => {
    const { tx } = fakeTx({ timezoneOffsetMinutes: IST });
    expect(await nextLeadReference(tx, "NEW_VISA", now)).toBe("10926VI001");
    expect(await nextLeadReference(tx, "OTB", now)).toBe("10926OT002");
    expect(await nextLeadReference(tx, "FLIGHT_SPECIAL_FARE", now)).toBe("10926FL003");
  });

  it("restarts the sequence at 001 when the local month rolls over", async () => {
    const { tx } = fakeTx({ timezoneOffsetMinutes: IST });
    // 18:29:59Z = 23:59:59 IST on Sep 30; 18:30:00Z = 00:00 IST on Oct 1.
    expect(await nextLeadReference(tx, "NEW_VISA", new Date("2026-09-30T18:29:00Z"))).toBe("10926VI001");
    expect(await nextLeadReference(tx, "NEW_VISA", new Date("2026-09-30T18:29:59Z"))).toBe("10926VI002");
    expect(await nextLeadReference(tx, "NEW_VISA", new Date("2026-09-30T18:30:00Z"))).toBe("11026VI001");
  });

  it("hands out distinct numbers to concurrent requests given an atomic counter", async () => {
    const { tx } = fakeTx({ timezoneOffsetMinutes: IST });
    const refs = await Promise.all(Array.from({ length: 10 }, () => nextLeadReference(tx, "OTB", now)));
    expect(new Set(refs).size).toBe(10);
    expect([...refs].sort()).toEqual(Array.from({ length: 10 }, (_, i) => formatReference("0926", "OT", i + 1)));
  });
});

describe("legacy lead references", () => {
  it("shows the stored reference when present, else derives the old PREFIX-SUFFIX form", () => {
    expect(leadReference({ reference: "10926VI001", serviceType: "NEW_VISA", id: "cmxyzjyoqhx" })).toBe("10926VI001");
    expect(leadReference({ reference: null, serviceType: "OTB", id: "cmxyzjyoqhx" })).toBe("OTB-JYOQHX");
  });

  it("parses legacy references and rejects anything else", () => {
    expect(parseLeadReference(" otb-JYOQHX ")).toEqual({ serviceType: "OTB", suffix: "jyoqhx" });
    expect(parseLeadReference("NV-ABC123")).toEqual({ serviceType: "NEW_VISA", suffix: "abc123" });
    expect(parseLeadReference("10926VI001")).toBeNull();
    expect(parseLeadReference("ZZ-ABC123")).toBeNull();
  });
});

describe("invoice numbering", () => {
  it("uses the Indian April-March financial year in the configured timezone", () => {
    expect(financialYear(new Date("2026-03-31T18:29:59Z"), IST)).toBe("2025-26");
    expect(financialYear(new Date("2026-03-31T18:30:00Z"), IST)).toBe("2026-27");
    expect(financialYear(new Date("2099-06-01T00:00:00Z"), IST)).toBe("2099-00");
  });

  it("numbers invoices sequentially per financial year with 4-digit padding", async () => {
    const { tx, counters } = fakeTx({ timezoneOffsetMinutes: IST });
    expect(await nextInvoiceNumber(tx, new Date("2026-03-30T10:00:00Z"))).toBe("INV-2025-26-0001");
    expect(await nextInvoiceNumber(tx, new Date("2026-04-02T10:00:00Z"))).toBe("INV-2026-27-0001");
    expect(await nextInvoiceNumber(tx, new Date("2026-09-30T10:00:00Z"))).toBe("INV-2026-27-0002");
    counters.set("2026-27", 9998);
    expect(await nextInvoiceNumber(tx, new Date("2026-09-30T10:00:00Z"))).toBe("INV-2026-27-9999");
    expect(await nextInvoiceNumber(tx, new Date("2026-09-30T10:00:00Z"))).toBe("INV-2026-27-10000");
  });
});

describe("booking id for a lead", () => {
  const lead = { reference: "10926VI001", id: "cmlead1" };

  it("reuses the lead reference as the booking id", async () => {
    expect(await bookingIdForLead(fakeTx().tx, lead)).toBe("10926VI001");
  });

  it("appends -2, -3, ... for later bookings on the same lead", async () => {
    expect(await bookingIdForLead(fakeTx({ takenBookingIds: ["10926VI001"] }).tx, lead)).toBe("10926VI001-2");
    expect(await bookingIdForLead(fakeTx({ takenBookingIds: ["10926VI001", "10926VI001-2", "10926VI001-3"] }).tx, lead)).toBe("10926VI001-4");
  });

  it("falls back to the lead id when the lead has no stored reference", async () => {
    expect(await bookingIdForLead(fakeTx().tx, { reference: null, id: "cmlead1" })).toBe("cmlead1");
  });
});
