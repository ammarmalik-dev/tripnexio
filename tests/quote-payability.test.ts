import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Quotation } from "@/generated/prisma/client";

const { quotationFindFirst, paymentFindMany } = vi.hoisted(() => ({
  quotationFindFirst: vi.fn(),
  paymentFindMany: vi.fn(),
}));

// Both modules read through the global Prisma client — stubbed in memory.
vi.mock("@/lib/db", () => ({
  db: { quotation: { findFirst: quotationFindFirst }, payment: { findMany: paymentFindMany } },
}));

import { isExpiredNow, syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { assertQuotationPayable, QUOTATION_EXPIRED_MESSAGE } from "@/lib/payments/quotation-payable";

const NOW = new Date("2026-09-30T06:00:00Z");
const past = new Date(NOW.getTime() - 60_000);
const future = new Date(NOW.getTime() + 60_000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  quotationFindFirst.mockReset();
  paymentFindMany.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("isExpiredNow", () => {
  it("expired flag wins regardless of the date", () => {
    expect(isExpiredNow({ isExpired: true, validityExpiresAt: future })).toBe(true);
    expect(isExpiredNow({ isExpired: true, validityExpiresAt: null })).toBe(true);
  });

  it("otherwise compares validityExpiresAt to now", () => {
    expect(isExpiredNow({ isExpired: false, validityExpiresAt: past })).toBe(true);
    expect(isExpiredNow({ isExpired: false, validityExpiresAt: future })).toBe(false);
    expect(isExpiredNow({ isExpired: false, validityExpiresAt: null })).toBe(false);
  });
});

describe("assertQuotationPayable", () => {
  const primary = { purpose: "PRIMARY" as const, booking: { leadId: "lead1" } };

  it("EXTRA payments are always payable without a lookup", async () => {
    expect(await assertQuotationPayable({ purpose: "EXTRA", booking: { leadId: "lead1" } })).toBeNull();
    expect(quotationFindFirst).not.toHaveBeenCalled();
  });

  it("a PRIMARY payment with no selected quotation is treated as expired", async () => {
    quotationFindFirst.mockResolvedValue(null);
    expect(await assertQuotationPayable(primary)).toBe(QUOTATION_EXPIRED_MESSAGE);
    expect(quotationFindFirst.mock.calls[0][0]).toMatchObject({ where: { leadId: "lead1", isSelected: true } });
  });

  it("payable while the selected quotation is valid, not once it lapses", async () => {
    quotationFindFirst.mockResolvedValueOnce({ isExpired: false, validityExpiresAt: future });
    expect(await assertQuotationPayable(primary)).toBeNull();
    quotationFindFirst.mockResolvedValueOnce({ isExpired: false, validityExpiresAt: past });
    expect(await assertQuotationPayable(primary)).toBe(QUOTATION_EXPIRED_MESSAGE);
  });
});

describe("syncExpiredQuotations — rows it must never flip", () => {
  const quote = (overrides: Partial<Quotation>) =>
    ({ id: "q", leadId: "lead1", isDraft: false, isSelected: false, isExpired: false, validityExpiresAt: past, ...overrides }) as Quotation;

  it("leaves drafts, selected, already-expired and still-valid quotations untouched with no DB work", async () => {
    const input = [
      quote({ id: "draft", isDraft: true }),
      quote({ id: "selected", isSelected: true }),
      quote({ id: "expired", isExpired: true }),
      quote({ id: "valid", validityExpiresAt: future }),
    ];
    const result = await syncExpiredQuotations(input);
    expect(result).toBe(input);
    expect(paymentFindMany).not.toHaveBeenCalled();
  });

  it("does not expire a past-due quotation on a lead that already has a successful payment", async () => {
    paymentFindMany.mockResolvedValue([{ booking: { leadId: "lead1" } }]);
    const input = [quote({ id: "pastDue" })];
    expect(await syncExpiredQuotations(input)).toBe(input);
    expect(paymentFindMany).toHaveBeenCalledTimes(1);
  });
});
