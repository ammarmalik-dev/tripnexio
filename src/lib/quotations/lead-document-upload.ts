import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";

/** Client doc 2026-10-15 — before the quotation, the customer uploads these per passenger from the quote page. */
export const LEAD_UPLOAD_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["VISA_EXTENSION", "VISA_CHANGE"]);
export const LEAD_UPLOAD_TYPES = [
  { type: "PASSPORT", label: "Passport copy" },
  { type: "VISA_COPY", label: "Current visa copy" },
] as const;

export interface LeadUploadPassenger {
  id: string;
  fullName: string;
  documents: { type: string; status: string }[];
}

/** The lead's passengers (in order) with the status of each upload type; empty for other services. */
export async function leadUploadPassengers(lead: { id: string; serviceType: ServiceType; details: unknown }): Promise<LeadUploadPassenger[]> {
  if (!LEAD_UPLOAD_SERVICES.has(lead.serviceType)) return [];
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(details.passengerIds) ? details.passengerIds.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return [];
  const passengers = await db.passenger.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      fullName: true,
      documents: { where: { leadId: lead.id, type: { in: LEAD_UPLOAD_TYPES.map((entry) => entry.type) }, purgedAt: null }, select: { type: true, status: true }, orderBy: { updatedAt: "desc" } },
    },
  });
  return ids
    .map((id) => passengers.find((passenger) => passenger.id === id))
    .filter((passenger): passenger is NonNullable<typeof passenger> => Boolean(passenger))
    .map((passenger) => ({
      id: passenger.id,
      fullName: passenger.fullName,
      documents: LEAD_UPLOAD_TYPES.flatMap((entry) => {
        const latest = passenger.documents.find((doc) => doc.type === entry.type);
        return latest ? [{ type: entry.type, status: latest.status }] : [];
      }),
    }));
}
