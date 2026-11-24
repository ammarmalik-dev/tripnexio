import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import { getRequirementDocumentTypes } from "../checkout/required-documents";
import { leadPassengersFor } from "../quotations/lead-passengers";
import { OUTPUT_TYPES } from "../outputs/output-types";

/**
 * Client doc 16 Nov (E6) — a staff-created Visa Extension lead shows the Admin-configured documents (Document
 * requirements for the service, UAE rows included) for each passenger as "Pending" slots on the lead, so staff can
 * upload them. Never touches an existing document; returns how many slots it created.
 */
export async function createLeadDocumentSlots(leadId: string, serviceType: ServiceType): Promise<number> {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { details: true, countryId: true } });
  if (!lead) return 0;
  const passengers = await leadPassengersFor(lead.details);
  if (passengers.length === 0) return 0;
  // Client doc 16 Nov (D1 / D5) — Visa Change: before payment only the visa copy (the rest follows after payment).
  const uae = serviceType === "VISA_EXTENSION" ? await db.country.findFirst({ where: { code: { in: ["AE", "ARE", "UAE"], mode: "insensitive" } }, select: { id: true } }) : null;
  const types =
    serviceType === "VISA_CHANGE"
      ? [{ type: "VISA_COPY", label: "Visa copy", required: true }]
      : // Client doc 16 Nov (C3) — OTB: the destination country's documents (the lead's country).
        (await getRequirementDocumentTypes(serviceType, serviceType === "VISA_EXTENSION" ? (uae?.id ?? null) : lead.countryId)).filter((type) => !(OUTPUT_TYPES as readonly string[]).includes(type.type));
  if (types.length === 0) return 0;
  const existing = await db.document.findMany({ where: { leadId, passengerId: { in: passengers.map((row) => row.id) } }, select: { passengerId: true, type: true } });
  const have = new Set(existing.map((doc) => `${doc.passengerId}|${doc.type}`));
  const missing = passengers.flatMap((passenger) => types.filter((type) => !have.has(`${passenger.id}|${type.type}`)).map((type) => ({ passengerId: passenger.id, type: type.type })));
  if (missing.length === 0) return 0;
  await db.document.createMany({ data: missing.map((slot) => ({ leadId, passengerId: slot.passengerId, type: slot.type, status: "REQUIRED" as const })) });
  return missing.length;
}
