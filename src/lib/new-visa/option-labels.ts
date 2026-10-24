import { db } from "../db";
import { productLabel } from "./products";

function record(details: unknown): Record<string, unknown> | null {
  return details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, unknown>) : null;
}

const needsLabel = (data: Record<string, unknown> | null): data is Record<string, unknown> =>
  !!data && typeof data.newVisaConfigId === "string" && !(typeof data.visaOption === "string" && data.visaOption.trim());

/**
 * Client doc 2026-10-20 (E7) — New Visa leads stored before the option label was saved (and manual leads)
 * carry only `newVisaConfigId`. Looks every such product up once and returns a mapper that fills
 * `visaOption` (Stay · Entry · Category) so the CRM "Service Details" line is never blank.
 */
export async function newVisaOptionFiller(detailsList: unknown[]): Promise<(details: unknown) => unknown> {
  const ids = [...new Set(detailsList.map(record).filter(needsLabel).map((data) => data.newVisaConfigId as string))];
  if (ids.length === 0) return (details) => details;
  const configs = await db.newVisaCountryConfig.findMany({
    where: { id: { in: ids } },
    select: { id: true, stayDays: true, duration: true, entryKind: true, entryType: true, visaCategory: true, validityType: { select: { name: true } } },
  });
  const labels = new Map(configs.map((config) => [config.id, productLabel(config)]));
  return (details) => {
    const data = record(details);
    if (!needsLabel(data)) return details;
    const label = labels.get(data.newVisaConfigId as string);
    return label ? { ...data, visaOption: label } : details;
  };
}
