import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import { leadSubServiceCodes, vendorCoversSubService } from "./sub-service-match";

/**
 * Admin handover §12 — the SubService codes a lead's details point at (see leadSubServiceCodes).
 * Uses the global client: call it before any transaction.
 */
export async function resolveLeadSubServiceCodes(serviceType: ServiceType, details: unknown): Promise<string[]> {
  const rows = await db.subService.findMany({ where: { serviceType }, select: { id: true, code: true } });
  if (rows.length === 0) return [];
  return leadSubServiceCodes(
    details,
    rows.map((row) => row.code),
    new Map(rows.map((row) => [row.id, row.code]))
  );
}

/**
 * Whether `vendorId` may process a lead of `serviceType` with these sub-service codes: it must be
 * linked to the service, and that link must cover the sub-service (empty list = all). Returns an
 * error message, or null when the vendor qualifies. `requireServiceLink: false` only checks the
 * sub-service coverage of an existing link (a vendor with no link to the service passes).
 */
export async function vendorSubServiceProblem(
  vendorId: string,
  serviceType: ServiceType,
  leadCodes: readonly string[],
  options: { requireServiceLink?: boolean } = {}
): Promise<string | null> {
  const link = await db.vendorService.findUnique({
    where: { vendorId_service: { vendorId, service: serviceType } },
    select: { subServiceCodes: true },
  });
  if (!link) return options.requireServiceLink === false ? null : "This vendor isn't set up for this service.";
  if (!vendorCoversSubService(link.subServiceCodes, leadCodes)) return "This vendor doesn't handle this sub-service.";
  return null;
}
