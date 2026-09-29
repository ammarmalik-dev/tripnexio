import { db } from "../db";
import type { CheckoutDocumentType } from "./required-documents";

/** P10 — a returning passenger's upload can be reused for this long. */
export const REUSE_WINDOW_DAYS = 90;

export interface ReusableDocument {
  passengerId: string;
  /** The checkout document type it would fill. */
  type: string;
  sourceDocumentId: string;
  uploadedAt: string;
}

/** Does an earlier document of `sourceType` fit this checkout slot? Same type, or a passport/photo upload for the matching New Visa slot. */
function fits(slot: CheckoutDocumentType, sourceType: string): boolean {
  if (sourceType === slot.type) return true;
  const label = slot.label.toLowerCase();
  if (sourceType === "PASSPORT" && label.includes("passport") && !/(last|back)/.test(label) && !label.includes("photo")) return true;
  if (/photo/i.test(sourceType) && label.includes("photo")) return true;
  return false;
}

/**
 * P10 — New Visa "Use Existing / Upload New": for each passenger slot not yet
 * uploaded on this booking, the passenger's most recent matching upload from
 * the last 3 months (passport front / photograph, never purged or rejected).
 * Only ever offered — nothing is reused without the customer's click.
 */
export async function findReusableDocuments(input: {
  bookingId: string;
  passengerIds: string[];
  documentTypes: CheckoutDocumentType[];
  uploaded: { passengerId: string; type: string }[];
}): Promise<ReusableDocument[]> {
  if (input.passengerIds.length === 0 || input.documentTypes.length === 0) return [];
  const since = new Date(Date.now() - REUSE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await db.document.findMany({
    where: {
      passengerId: { in: input.passengerIds },
      fileUrl: { not: null },
      purgedAt: null,
      status: { in: ["RECEIVED", "VERIFIED"] },
      createdAt: { gte: since },
      OR: [{ bookingId: null }, { bookingId: { not: input.bookingId } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, passengerId: true, type: true, createdAt: true },
  });

  const result: ReusableDocument[] = [];
  for (const passengerId of input.passengerIds) {
    for (const slot of input.documentTypes) {
      if (input.uploaded.some((doc) => doc.passengerId === passengerId && doc.type === slot.type)) continue;
      if (result.some((offer) => offer.passengerId === passengerId && offer.type === slot.type)) continue;
      const source = candidates.find((candidate) => candidate.passengerId === passengerId && fits(slot, candidate.type));
      if (source) result.push({ passengerId, type: slot.type, sourceDocumentId: source.id, uploadedAt: source.createdAt.toISOString() });
    }
  }
  return result;
}
