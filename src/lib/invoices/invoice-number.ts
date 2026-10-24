import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { getTimezoneOffsetMinutes } from "../settings/system-config";

/** Indian financial year (April-March) of `date` in the given timezone, e.g. "2026-27". */
export function financialYear(date: Date, timezoneOffsetMinutes: number): string {
  const local = new Date(date.getTime() + timezoneOffsetMinutes * 60 * 1000);
  const startYear = local.getUTCMonth() >= 3 ? local.getUTCFullYear() : local.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** The letter block for the n-th run of 99 numbers: 0 → A … 25 → Z, 26 → AA, 27 → AB … (like spreadsheet columns). */
export function invoiceLetters(block: number): string {
  let value = block + 1;
  let letters = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

/**
 * Client confirmation 2026-10-25 — the invoice number for the n-th invoice (1-based) of a financial year:
 * "TNS/A02601" … "TNS/A02699", then "TNS/B02601" … "TNS/Z02699", then "TNS/AA02601"… — the letter block moves on
 * by itself, without limit, and every number is unique. "26" is the year the financial year starts
 * (TNS/A02701 from 1 April 2027).
 */
export function formatInvoiceNumber(financialYearLabel: string, sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  const block = Math.floor((n - 1) / 99);
  const within = ((n - 1) % 99) + 1;
  return `TNS/${invoiceLetters(block)}0${financialYearLabel.slice(2, 4)}${String(within).padStart(2, "0")}`;
}

/**
 * The next sequential tax-invoice number (see formatInvoiceNumber). This series has its own counter row per
 * financial year ("TNSA0-2026-27"), so it starts at TNS/A02601; invoices already issued keep their numbers
 * (TNS/A2601…, TNS26/A01…, INV-2026-27-0001), which can never collide with the new form. Incremented atomically
 * and stored on the Payment by the caller, so an invoice keeps the same number every time it's downloaded or emailed.
 */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, now: Date = new Date()): Promise<string> {
  const year = financialYear(now, await getTimezoneOffsetMinutes(tx));
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "InvoiceCounter" ("financialYear", "lastValue", "updatedAt")
    VALUES (${`TNSA0-${year}`}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("financialYear") DO UPDATE SET "lastValue" = "InvoiceCounter"."lastValue" + 1, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastValue"`;
  return formatInvoiceNumber(year, Number(rows[0].lastValue));
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
