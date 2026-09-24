import { db } from "../db";
import { readFileBytes } from "../storage/local-file-storage";
import type { InvoiceCompanyDetails } from "./render-invoice";

const INVOICE_CONFIG_ID = "singleton";

/**
 * Fetches the admin-configured InvoiceConfig singleton and resolves its
 * logo/signature URLs into real Buffers (renderInvoicePdf never fetches
 * anything itself — see that file's own doc comment — so this is where
 * that I/O happens, shared by every caller that builds an invoice).
 * Falls back to all-empty fields if the row is somehow missing, same
 * fallback pattern as getTaxFeeRates()/getServiceTimelineRules().
 */
export async function getInvoiceCompanyDetails(): Promise<InvoiceCompanyDetails> {
  const config = await db.invoiceConfig.findUnique({ where: { id: INVOICE_CONFIG_ID } });

  const [logoBuffer, signatureBuffer] = await Promise.all([
    config?.companyLogoUrl ? readLogoSafely(config.companyLogoUrl) : Promise.resolve(null),
    config?.signatureImageUrl ? readLogoSafely(config.signatureImageUrl) : Promise.resolve(null),
  ]);

  return {
    gstNumber: config?.companyGstNumber ?? null,
    sacCode: config?.defaultSacCode ?? null,
    logoBuffer,
    bankAccountName: config?.bankAccountName ?? null,
    bankAccountNumber: config?.bankAccountNumber ?? null,
    bankIfscCode: config?.bankIfscCode ?? null,
    bankName: config?.bankName ?? null,
    bankBranch: config?.bankBranch ?? null,
    termsAndNotes: config?.termsAndNotes ?? null,
    signatoryName: config?.signatoryName ?? null,
    signatoryTitle: config?.signatoryTitle ?? null,
    signatureBuffer,
  };
}

/** A broken/missing logo or signature file must never block invoice generation. */
async function readLogoSafely(url: string): Promise<Buffer | null> {
  try {
    const { base64 } = await readFileBytes(url);
    return Buffer.from(base64, "base64");
  } catch (error) {
    console.error(`[invoices/company-config] couldn't read "${url}"`, error);
    return null;
  }
}
