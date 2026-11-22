import { db } from "../db";
import { productLabel } from "./products";

function record(details: unknown): Record<string, unknown> | null {
  return details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, unknown>) : null;
}

const hasProduct = (data: Record<string, unknown> | null): data is Record<string, unknown> => !!data && typeof data.newVisaConfigId === "string";

/**
 * Client doc 2026-10-20 (E7) — New Visa leads carry the product id; the CRM "Service Details" line is never blank.
 * Client doc 16 Nov (F7/F8) — the visa type (Tourist / Transit / Any) has its own place (the Service column), so
 * `visaOption` is Stay · Entry (· Validity when the country shows it) and `visaCategory` carries the type.
 */
export async function newVisaOptionFiller(detailsList: unknown[]): Promise<(details: unknown) => unknown> {
  const ids = [...new Set(detailsList.map(record).filter(hasProduct).map((data) => data.newVisaConfigId as string))];
  if (ids.length === 0) return (details) => details;
  const configs = await db.newVisaCountryConfig.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      stayDays: true,
      duration: true,
      entryKind: true,
      entryType: true,
      visaCategory: true,
      validityType: { select: { name: true } },
      country: { select: { showVisaValidity: true } },
    },
  });
  const byId = new Map(configs.map((config) => [config.id, { visaOption: productLabel({ ...config, visaCategory: null }), visaCategory: config.visaCategory?.trim() || "Any" }]));
  return (details) => {
    const data = record(details);
    if (!hasProduct(data)) return details;
    const filled = byId.get(data.newVisaConfigId as string);
    return filled ? { ...data, ...filled } : details;
  };
}
