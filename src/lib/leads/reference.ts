import type { Prisma } from "../../generated/prisma/client";
import type { ServiceType } from "../../generated/prisma/enums";
import { getTimezoneOffsetMinutes } from "../settings/system-config";

/**
 * Fallback reference codes, used only when a service has no Service row.
 * NEW_VISA "VI", FLIGHT_SPECIAL_FARE "FL" and RETURN_TICKET "RT" are the
 * client's own examples (Locked Business Rules v2.0 §4). VISA_EXTENSION
 * "VE", VISA_CHANGE "VC", OTB "OT" and OTHER "OS" are PENDING CLIENT
 * CONFIRMATION — the live values are Service.referenceCode, editable at
 * Admin → Services.
 */
const DEFAULT_REFERENCE_CODES: Record<ServiceType, string> = {
  NEW_VISA: "VI",
  FLIGHT_SPECIAL_FARE: "FL",
  RETURN_TICKET: "RT",
  VISA_EXTENSION: "VE",
  VISA_CHANGE: "VC",
  OTB: "OT",
  OTHER: "OS",
};

/** "MMYY" of `date` in the given timezone offset — the reference's period. */
export function referencePeriod(date: Date, timezoneOffsetMinutes: number): string {
  const local = new Date(date.getTime() + timezoneOffsetMinutes * 60 * 1000);
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const year = String(local.getUTCFullYear() % 100).padStart(2, "0");
  return `${month}${year}`;
}

/** 1 + MM + YY + ServiceCode + sequence (at least 3 digits), e.g. "10626VI001". */
export function formatReference(period: string, serviceCode: string, sequence: number): string {
  return `1${period}${serviceCode}${String(sequence).padStart(3, "0")}`;
}

/**
 * Generates the next locked reference inside the lead-creation transaction.
 * The monthly sequence is shared by every service and incremented with a
 * single atomic upsert, so concurrent requests never get the same number,
 * and a number is never handed out twice — even if the lead is later
 * cancelled, deleted or refunded, or this transaction rolls back after the
 * increment (a gap, never a repeat).
 */
export async function nextLeadReference(tx: Prisma.TransactionClient, serviceType: ServiceType, now: Date = new Date()): Promise<string> {
  const period = referencePeriod(now, await getTimezoneOffsetMinutes(tx));
  const service = await tx.service.findUnique({ where: { code: serviceType }, select: { referenceCode: true } });
  const code = service?.referenceCode || DEFAULT_REFERENCE_CODES[serviceType];

  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "ReferenceCounter" ("period", "lastValue", "updatedAt")
    VALUES (${period}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("period") DO UPDATE SET "lastValue" = "ReferenceCounter"."lastValue" + 1, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastValue"`;
  return formatReference(period, code, Number(rows[0].lastValue));
}

// ---------------------------------------------------------------------------
// Pre-P07 references ("OTB-JYOQHX", derived from the last 6 characters of
// the lead id). Existing leads keep them; they're only derived here for a
// row that somehow has no stored reference.

const LEGACY_REFERENCE_PREFIX: Record<ServiceType, string> = {
  NEW_VISA: "NV",
  VISA_EXTENSION: "VE",
  VISA_CHANGE: "VC",
  FLIGHT_SPECIAL_FARE: "FF",
  RETURN_TICKET: "RT",
  OTB: "OTB",
  OTHER: "OS",
};

function legacyLeadReference(serviceType: ServiceType, leadId: string): string {
  return `${LEGACY_REFERENCE_PREFIX[serviceType]}-${leadId.slice(-6).toUpperCase()}`;
}

/** The reference to show for a lead: its stored reference (new or old format). */
export function leadReference(lead: { reference: string | null; serviceType: ServiceType; id: string }): string {
  return lead.reference ?? legacyLeadReference(lead.serviceType, lead.id);
}

const LEGACY_PREFIX_TO_SERVICE: Record<string, ServiceType> = Object.fromEntries(
  Object.entries(LEGACY_REFERENCE_PREFIX).map(([serviceType, prefix]) => [prefix, serviceType as ServiceType])
);

/**
 * Parses an old "PREFIX-SUFFIX" reference (e.g. "OTB-058517") back into a
 * serviceType + id suffix, for lookups of leads that predate stored
 * references. New-format references are matched exactly on Lead.reference
 * instead. Returns null for anything else.
 */
export function parseLeadReference(query: string): { serviceType: ServiceType; suffix: string } | null {
  const match = /^([A-Za-z]+)-([A-Za-z0-9]+)$/.exec(query.trim());
  if (!match) return null;
  const serviceType = LEGACY_PREFIX_TO_SERVICE[match[1].toUpperCase()];
  if (!serviceType) return null;
  return { serviceType, suffix: match[2].toLowerCase() };
}
