import { db } from "@/lib/db";
import type { ServiceType } from "@/generated/prisma/enums";

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
  passengers: DocumentChecklistSnapshotPassenger[];
}

/**
 * Step 23 (audit §7.6) — frozen at booking creation, never re-read live
 * afterward. `DocumentRequirement` has no passenger-level concept (it's
 * keyed by nationality + serviceType, same as the public
 * /api/document-requirements route this mirrors), so this resolves each of
 * the booking's own passengers against their own `Passenger.nationality` —
 * a passenger with no nationality on file gets an empty requirements list,
 * same as the live route returns for an unrecognized nationality.
 */
export async function buildDocumentChecklistSnapshot(
  serviceType: ServiceType,
  passengers: { id: string; fullName: string; nationality: string | null }[]
): Promise<DocumentChecklistSnapshot> {
  const activeRequirements = await db.documentRequirement.findMany({
    where: { serviceType, active: true },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
    select: { nationality: true, documentName: true, required: true },
  });

  return {
    generatedAt: new Date().toISOString(),
    serviceType,
    passengers: passengers.map((passenger) => {
      const normalizedNationality = passenger.nationality?.trim().toLowerCase() || null;
      return {
        passengerId: passenger.id,
        fullName: passenger.fullName,
        nationality: passenger.nationality,
        requirements: normalizedNationality
          ? activeRequirements
              .filter((requirement) => requirement.nationality.trim().toLowerCase() === normalizedNationality)
              .map((requirement) => ({ documentName: requirement.documentName, required: requirement.required }))
          : [],
      };
    }),
  };
}
