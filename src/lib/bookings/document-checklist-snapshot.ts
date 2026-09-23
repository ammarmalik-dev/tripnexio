import { db } from "@/lib/db";
import type { ServiceType, PaxType } from "@/generated/prisma/enums";

export interface DocumentChecklistSnapshotItem {
  documentName: string;
  required: boolean;
}

export interface DocumentChecklistSnapshotPassenger {
  passengerId: string;
  fullName: string;
  nationality: string | null;
  requirements: DocumentChecklistSnapshotItem[];
}

export interface DocumentChecklistSnapshot {
  generatedAt: string;
  serviceType: ServiceType;
  /** Step 41 — the destination country this snapshot was matched against, if one was resolvable for this service/lead. */
  countryId: string | null;
  passengers: DocumentChecklistSnapshotPassenger[];
}

/**
 * Step 23 (audit §7.6) — frozen at booking creation, never re-read live
 * afterward. Step 41 (Admin FINAL handover §5): `DocumentRequirement` rows
 * are now matched on THREE independently-optional dimensions —
 * `countryId`, `nationality`, `paxType` — plus the always-required
 * `serviceType`. A row applies to a given passenger when every dimension
 * it sets matches (a dimension left null on the row applies universally
 * on that axis). This is a genuine improvement over the old
 * nationality-only match: a passenger with no nationality on file used to
 * get an empty checklist outright; now a country- or paxType-only rule
 * (nationality left unset) can still apply to them.
 */
export async function buildDocumentChecklistSnapshot(
  serviceType: ServiceType,
  passengers: { id: string; fullName: string; nationality: string | null; paxType?: PaxType | null }[],
  countryId?: string | null
): Promise<DocumentChecklistSnapshot> {
  const activeRequirements = await db.documentRequirement.findMany({
    where: { serviceType, active: true },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
    select: { countryId: true, nationality: true, paxType: true, documentName: true, required: true },
  });

  return {
    generatedAt: new Date().toISOString(),
    serviceType,
    countryId: countryId ?? null,
    passengers: passengers.map((passenger) => {
      const normalizedNationality = passenger.nationality?.trim().toLowerCase() || null;
      const requirements = activeRequirements.filter((requirement) => {
        if (requirement.countryId && requirement.countryId !== countryId) return false;
        if (requirement.nationality && requirement.nationality.trim().toLowerCase() !== normalizedNationality) return false;
        if (requirement.paxType && requirement.paxType !== passenger.paxType) return false;
        return true;
      });
      return {
        passengerId: passenger.id,
        fullName: passenger.fullName,
        nationality: passenger.nationality,
        requirements: requirements.map((requirement) => ({ documentName: requirement.documentName, required: requirement.required })),
      };
    }),
  };
}
