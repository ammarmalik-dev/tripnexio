import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { getTimezoneOffsetMinutes } from "../settings/system-config";

/** Indian financial year (April-March) of `date` in the given timezone, e.g. "2026-27". */
export function financialYear(date: Date, timezoneOffsetMinutes: number): string {
  const local = new Date(date.getTime() + timezoneOffsetMinutes * 60 * 1000);
  const startYear = local.getUTCMonth() >= 3 ? local.getUTCFullYear() : local.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * The next sequential tax-invoice number, e.g. "INV-2026-27-0001" (P07).
 * Incremented atomically per financial year and stored on the Payment by
 * the caller, so an invoice keeps the same number every time it's
 * downloaded or emailed.
 */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, now: Date = new Date()): Promise<string> {
  const year = financialYear(now, await getTimezoneOffsetMinutes(tx));
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "InvoiceCounter" ("financialYear", "lastValue", "updatedAt")
    VALUES (${year}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("financialYear") DO UPDATE SET "lastValue" = "InvoiceCounter"."lastValue" + 1, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastValue"`;
  return `INV-${year}-${String(Number(rows[0].lastValue)).padStart(4, "0")}`;
}

/**
 * A successful payment's persisted invoice number. Every payment that
 * succeeds gets one in completePaymentSuccess, and older ones were
 * backfilled by migration — this only assigns (once, and persists) for a
 * SUCCESS row that somehow has none, so the number is never recomputed.
 */
export async function ensureInvoiceNumber(payment: { id: string; invoiceNumber: string | null }): Promise<string> {
  if (payment.invoiceNumber) return payment.invoiceNumber;
  return db.$transaction(async (tx) => {
    const current = await tx.payment.findUnique({ where: { id: payment.id }, select: { invoiceNumber: true } });
    if (current?.invoiceNumber) return current.invoiceNumber;
    const invoiceNumber = await nextInvoiceNumber(tx);
    await tx.payment.update({ where: { id: payment.id }, data: { invoiceNumber } });
    return invoiceNumber;
  });
}
