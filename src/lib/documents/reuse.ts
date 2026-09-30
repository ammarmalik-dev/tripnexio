import { db } from "../db";
import { getSystemConfig } from "../settings/system-config";

/**
 * New_Visa.md §17 / Visa_Extension.md §16, locked, identical wording in
 * both: "Document age <= 3 months -> Use Existing / Upload New. Document
 * age > 3 months -> request new documents. Retained Passport Front and
 * Visa Copy may be offered for reuse after confirmation. Never reuse a
 * document without customer confirmation." This is a cross-service rule
 * (both docs give the exact same 3-month/retained-types split), not
 * specific to New Visa.
 */
/**
 * P27 - the reuse window is the Admin document-retention setting (no
 * hard-coded 90 days and no passport/visa exemption: every file is deleted
 * after the retention period, and a purged file is never offered).
 */
async function reuseWindowDays(): Promise<number> {
  return (await getSystemConfig()).documentRetentionDays;
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
  const windowDays = await reuseWindowDays();
  return documents.map((document) => {
    const ageInDays = Math.floor((now - document.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    return {
      id: document.id,
      type: document.type,
      fileUrl: document.fileUrl!,
      bookingId: document.bookingId,
      createdAt: document.createdAt,
      ageInDays,
      reusable: ageInDays <= windowDays,
    };
  });
}
