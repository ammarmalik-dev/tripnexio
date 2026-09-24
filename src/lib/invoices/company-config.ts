import { db } from "../db";
import { readFileBytes } from "../storage/local-file-storage";
import { getEffectiveSiteConfig, getSystemConfig } from "../settings/system-config";
import type { InvoiceCompanyDetails } from "./render-invoice";

const INVOICE_CONFIG_ID = "singleton";

/**
 * Fetches the admin-configured InvoiceConfig singleton and resolves its
 * logo/signature URLs into real Buffers (renderInvoicePdf never fetches
 * anything itself — see that file's own doc comment — so this is where
 * that I/O happens, shared by every caller that builds an invoice). Falls
 * back to all-empty fields if the row is somehow missing, same fallback
 * pattern as getTaxFeeRates()/getServiceTimelineRules().
 *
 * Step 45 addition: legalName/address/phone/email/currencyCode now come
 * from getEffectiveSiteConfig()/getSystemConfig() (SystemConfig overrides
 * merged over the static site-config.ts defaults) instead of
 * renderInvoicePdf importing siteConfig directly — this is the exact reuse
 * point InvoiceConfig's own doc comment (Step 44) pointed Step 45 at.
 */
export async function getInvoiceCompanyDetails(): Promise<InvoiceCompanyDetails> {
  const [config, effectiveSite, systemConfig] = await Promise.all([
    db.invoiceConfig.findUnique({ where: { id: INVOICE_CONFIG_ID } }),
    getEffectiveSiteConfig(),
    getSystemConfig(),
  ]);

  const [logoBuffer, signatureBuffer] = await Promise.all([
    config?.companyLogoUrl ? readLogoSafely(config.companyLogoUrl) : Promise.resolve(null),
    config?.signatureImageUrl ? readLogoSafely(config.signatureImageUrl) : Promise.resolve(null),
  ]);

  return {
    legalName: effectiveSite.legalName,
    address: effectiveSite.address,
    phone: effectiveSite.phone,
    email: effectiveSite.email,
    currencyCode: systemConfig.currencyCode,
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
