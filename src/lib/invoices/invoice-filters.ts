/**
 * Invoice History — pure, dependency-free helpers shared by the server
 * query/register code and the client screen (so nothing here may import
 * the Prisma client or any server-only module).
 */

export const INVOICE_REFUND_STATES = ["none", "partial", "full"] as const;
export type InvoiceRefundState = (typeof INVOICE_REFUND_STATES)[number];

export const INVOICE_SORTS = ["date_desc", "date_asc", "total_desc", "total_asc"] as const;
export type InvoiceSort = (typeof INVOICE_SORTS)[number];

/** Bulk PDF download cap — more than this returns 409 and the screen asks to narrow the filters. */
export const MAX_INVOICE_ZIP = 100;

/** "2026-27" — an Indian (April–March) financial year label, same shape invoice numbers carry (INV-2026-27-0001). */
export const FINANCIAL_YEAR_PATTERN = /^(\d{4})-(\d{2})$/;

/** Half-a-paisa tolerance for money comparisons on Decimal(10,2) values. */
const EPSILON = 0.005;

/**
 * Only COMPLETED refunds count as money given back. "full" once completed
 * refunds cover the invoice total; "partial" for anything in between.
 */
export function invoiceRefundState(total: number, refundedAmount: number): InvoiceRefundState {
  if (refundedAmount < EPSILON) return "none";
  if (refundedAmount + EPSILON >= total) return "full";
  return "partial";
}

/** True when `label` is a well-formed FY label whose second half is the start year + 1 (e.g. "2026-27", not "2026-29"). */
export function isValidFinancialYear(label: string): boolean {
  const match = FINANCIAL_YEAR_PATTERN.exec(label);
  if (!match) return false;
  const startYear = Number(match[1]);
  return (startYear + 1) % 100 === Number(match[2]);
}

/** FY label of `date` in the given timezone offset — same rule as src/lib/invoices/invoice-number.ts financialYear(). */
export function financialYearOf(date: Date, timezoneOffsetMinutes: number): string {
  const local = new Date(date.getTime() + timezoneOffsetMinutes * 60 * 1000);
  const startYear = local.getUTCMonth() >= 3 ? local.getUTCFullYear() : local.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * The instant range [start, end) of a financial year: 1 April 00:00 local
 * time of the start year up to (excluding) 1 April of the next year.
 */
export function financialYearRange(label: string, timezoneOffsetMinutes: number): { start: Date; end: Date } {
  const match = FINANCIAL_YEAR_PATTERN.exec(label);
  if (!match) throw new Error(`Invalid financial year "${label}"`);
  const startYear = Number(match[1]);
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  return {
    start: new Date(Date.UTC(startYear, 3, 1) - offsetMs),
    end: new Date(Date.UTC(startYear + 1, 3, 1) - offsetMs),
  };
}

/** Invoice-number prefix for a financial year, e.g. "INV-2026-27-". */
export function invoiceNumberPrefix(label: string): string {
  return `INV-${label}-`;
}

/** The current FY and the `count - 1` before it, newest first — the filter dropdown's options. */
export function financialYearOptions(now: Date, timezoneOffsetMinutes: number, count = 5): string[] {
  const current = Number(financialYearOf(now, timezoneOffsetMinutes).slice(0, 4));
  return Array.from({ length: count }, (_, index) => {
    const startYear = current - index;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  });
}

export interface SortableInvoice {
  id: string;
  issuedAt: Date;
  total: number;
}

/** Stable comparator for the register's sort options (ties broken by id so pages never shuffle). */
export function compareInvoices(sort: InvoiceSort): (a: SortableInvoice, b: SortableInvoice) => number {
  return (a, b) => {
    let diff: number;
    switch (sort) {
      case "date_asc":
        diff = a.issuedAt.getTime() - b.issuedAt.getTime();
        break;
      case "total_desc":
        diff = b.total - a.total;
        break;
      case "total_asc":
        diff = a.total - b.total;
        break;
      case "date_desc":
      default:
        diff = b.issuedAt.getTime() - a.issuedAt.getTime();
        break;
    }
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Rounds to paise — summary sums of many Decimal(10,2) values otherwise drift in floating point. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
