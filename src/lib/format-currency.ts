/**
 * Step 45 — the one shared currency formatter, reading the Admin-configured
 * SystemConfig.currencyCode (display formatting only; this business only
 * ever transacts in INR, locked India-to-GCC scope — see that field's own
 * schema comment). Currently wired into invoice PDFs
 * (src/lib/invoices/render-invoice.ts) only; every CRM/Admin table still
 * has its own hardcoded local `money()` helper (PaymentsTable.tsx,
 * QuoteCard.tsx, PnlReport.tsx, etc.) — flagged as a follow-up to repoint
 * at this shared helper, not done here to keep this step's diff contained
 * to the one call site that already needed touching for company info.
 */
export function formatCurrency(value: number, currencyCode: string = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
