import { cache } from "react";
import { db } from "../db";
import { siteConfig } from "../site-config";

const SYSTEM_CONFIG_ID = "singleton";

export interface SystemConfigValues {
  companyName: string | null;
  companyTagline: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  currencyCode: string;
  timezoneOffsetMinutes: number;
  documentRetentionDays: number;
  auditRetentionDays: number | null;
  backupRetentionDays: number | null;
  backupScheduleNote: string | null;
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string | null;
  systemAlertEmail: string | null;
  /** P20 — legal details (Admin → System Configuration); null = not supplied yet, never shown. */
  legalEntityName: string | null;
  gstin: string | null;
  jurisdiction: string | null;
  grievanceOfficerName: string | null;
  grievanceEmail: string | null;
  grievancePhone: string | null;
  grievanceAddress: string | null;
}

const DEFAULTS: SystemConfigValues = {
  companyName: null,
  companyTagline: null,
  companyAddress: null,
  companyPhone: null,
  companyEmail: null,
  currencyCode: "INR",
  timezoneOffsetMinutes: 330,
  documentRetentionDays: 90,
  auditRetentionDays: null,
  backupRetentionDays: null,
  backupScheduleNote: null,
  maintenanceModeEnabled: false,
  maintenanceMessage: null,
  systemAlertEmail: null,
  legalEntityName: null,
  gstin: null,
  jurisdiction: null,
  grievanceOfficerName: null,
  grievanceEmail: null,
  grievancePhone: null,
  grievanceAddress: null,
};

/**
 * Same fallback pattern as getTaxFeeRates()/getServiceTimelineRules() for a
 * missing row — but ALSO swallows any DB error (unlike those two), because
 * this one is called from the root layout (src/app/layout.tsx), which runs
 * for every single page including at `next build` static-generation time.
 * A transient DB hiccup here must never fail the whole site's build or
 * 500 an otherwise-unrelated page render — it just means this request
 * falls back to the static site-config.ts defaults/maintenance-off, same
 * as a genuinely missing row.
 *
 * Wrapped in React's `cache()` — the root layout calls this twice per
 * request (once from generateMetadata, once from RootLayout itself for
 * the maintenance banner); this dedupes those into a single DB query per
 * request instead of two, same technique Next's own docs recommend for
 * this exact "shared data between generateMetadata and the page" case.
 */
export const getSystemConfig = cache(async (): Promise<SystemConfigValues> => {
  let config;
  try {
    config = await db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID } });
  } catch (error) {
    console.error("[settings/system-config] couldn't read SystemConfig, using defaults", error);
    return DEFAULTS;
  }
  if (!config) return DEFAULTS;
  return {
    companyName: config.companyName,
    companyTagline: config.companyTagline,
    companyAddress: config.companyAddress,
    companyPhone: config.companyPhone,
    companyEmail: config.companyEmail,
    currencyCode: config.currencyCode,
    timezoneOffsetMinutes: config.timezoneOffsetMinutes,
    documentRetentionDays: config.documentRetentionDays,
    auditRetentionDays: config.auditRetentionDays,
    backupRetentionDays: config.backupRetentionDays,
    backupScheduleNote: config.backupScheduleNote,
    maintenanceModeEnabled: config.maintenanceModeEnabled,
    maintenanceMessage: config.maintenanceMessage,
    systemAlertEmail: config.systemAlertEmail,
    legalEntityName: config.legalEntityName,
    gstin: config.gstin,
    jurisdiction: config.jurisdiction,
    grievanceOfficerName: config.grievanceOfficerName,
    grievanceEmail: config.grievanceEmail,
    grievancePhone: config.grievancePhone,
    grievanceAddress: config.grievanceAddress,
  };
});

/**
 * The Admin-configured timezone offset read through the caller's own client —
 * for code already inside a transaction (reference and invoice numbering),
 * which must not wait on a second pooled connection. Same IST default as
 * getSystemConfig().
 */
export async function getTimezoneOffsetMinutes(client: Pick<typeof db, "systemConfig">): Promise<number> {
  const row = await client.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { timezoneOffsetMinutes: true } });
  return row?.timezoneOffsetMinutes ?? DEFAULTS.timezoneOffsetMinutes;
}

export interface EffectiveSiteConfig {
  /** Short brand name — used in page metadata/titles. */
  name: string;
  /** Formal registered name — used on invoices. A single `companyName` override affects both (this Admin screen doesn't distinguish "trading name" vs. "legal name" as two separate concepts). */
  legalName: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
}

/**
 * Merges SystemConfig's Admin-editable overrides over the static
 * site-config.ts defaults (null = keep the static default) — the reuse
 * point Step 44's InvoiceConfig doc comment pointed at, not a duplicate.
 * Used by the root layout's page metadata and by every invoice PDF (via
 * src/lib/invoices/company-config.ts). Deliberately does NOT touch
 * siteConfig.url/ogImage/socials — those are deploy-time/SEO-structural
 * concerns, not something an Admin should be able to repoint by accident.
 */
export async function getEffectiveSiteConfig(): Promise<EffectiveSiteConfig> {
  const config = await getSystemConfig();
  // A blank Admin field (saved as "") means "not set" too, not "show nothing".
  const pick = (value: string | null, fallback: string) => (value?.trim() ? value.trim() : fallback);
  return {
    name: pick(config.companyName, siteConfig.name),
    legalName: pick(config.companyName, siteConfig.legalName),
    tagline: pick(config.companyTagline, siteConfig.tagline),
    description: siteConfig.description,
    address: pick(config.companyAddress, siteConfig.contact.address),
    phone: pick(config.companyPhone, siteConfig.contact.phone),
    email: pick(config.companyEmail, siteConfig.contact.email),
  };
}

/**
 * P24 — Admin → Payment Gateway's "Default payment-link validity (hours)".
 * null = not set (callers fall back to DEFAULT_PAYMENT_LINK_VALIDITY_HOURS).
 * Reads through the caller's own client so it can be used without touching
 * the global `db` from inside a transaction; createGatewayPayment calls it
 * before opening its own transaction, with the default `db`.
 */
export async function getDefaultPaymentLinkHours(client: Pick<typeof db, "systemConfig"> = db): Promise<number | null> {
  const row = await client.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { defaultPaymentLinkHours: true } });
  return row?.defaultPaymentLinkHours ?? null;
}
