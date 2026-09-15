import { db } from "../db";

/**
 * New_Visa.md §17 / Visa_Extension.md §16, locked, identical wording in
 * both: "Document age <= 3 months -> Use Existing / Upload New. Document
 * age > 3 months -> request new documents. Retained Passport Front and
 * Visa Copy may be offered for reuse after confirmation. Never reuse a
 * document without customer confirmation." This is a cross-service rule
 * (both docs give the exact same 3-month/retained-types split), not
 * specific to New Visa.
 */
export const REUSE_WINDOW_DAYS = 90;

/** Same type-matching convention already established for OCR auto-trigger and retention purge — see DocumentExtraction/purge job's own comments. */
function isRetainedType(type: string): boolean {
  return /passport/i.test(type) || /visa/i.test(type);
}

export interface ReusableDocument {
  id: string;
  type: string;
  fileUrl: string;
  bookingId: string | null;
  createdAt: Date;
  ageInDays: number;
  /** Always requires explicit staff/customer confirmation to actually reuse — this only says whether offering it is appropriate at all. */
  reusable: boolean;
}

/**
 * Every one of a passenger's own documents (across every booking/lead they've
 * ever been part of — "if a passenger appears in a FUTURE booking" per §17)
 * that still has a file, classified per the age/type rule above. Excludes
 * anything already purged (Step 21's own retention job) since there's no
 * file left to reuse.
 */
export async function getReusableDocumentsForPassenger(passengerId: string): Promise<ReusableDocument[]> {
  const documents = await db.document.findMany({
    where: { passengerId, fileUrl: { not: null }, purgedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  return documents.map((document) => {
    const ageInDays = Math.floor((now - document.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    return {
      id: document.id,
      type: document.type,
      fileUrl: document.fileUrl!,
      bookingId: document.bookingId,
      createdAt: document.createdAt,
      ageInDays,
      reusable: ageInDays <= REUSE_WINDOW_DAYS || isRetainedType(document.type),
    };
  });
}
