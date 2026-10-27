/**
 * Client doc 2026-10-27 (C8 / E3) — what counts as "Uploaded" on the customer's pay page.
 * A paid booking gets a "Pending" (REQUIRED) slot row for every configured document
 * (`ensureRequiredDocumentSlots`), so "a Document row exists" is not "a file was uploaded".
 * Only a real file for this booking's passenger counts: RECEIVED with a stored file, or
 * VERIFIED (staff validated it). REQUIRED / MISSING slots and REJECTED files still need an
 * upload. Earlier uploads from other bookings are never counted — they are only offered via
 * "Use existing" (`findReusableDocuments`), and only the customer's click attaches one.
 */

export interface DocumentUploadRow {
  passengerId: string | null;
  type: string;
  status: string;
  fileUrl: string | null;
}

export function isDocumentUploaded(row: Pick<DocumentUploadRow, "status" | "fileUrl">): boolean {
  if (row.status === "VERIFIED") return true;
  return row.status === "RECEIVED" && Boolean(row.fileUrl);
}

/** The passenger + type pairs that really have a file uploaded (one entry per pair). */
export function uploadedDocumentSlots(rows: DocumentUploadRow[]): { passengerId: string; type: string }[] {
  const seen = new Set<string>();
  const result: { passengerId: string; type: string }[] = [];
  for (const row of rows) {
    if (!row.passengerId || !isDocumentUploaded(row)) continue;
    const key = `${row.passengerId}|${row.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ passengerId: row.passengerId, type: row.type });
  }
  return result;
}

/**
 * "N of M required uploaded" — counts each passenger's required types that have a real file. A type with
 * `passengerIds` (client doc 2026-10-27, D11: a nationality-specific Visa Change document) counts only for them.
 */
export function countRequiredUploaded(input: {
  passengerIds: string[];
  requiredTypes: (string | { type: string; passengerIds?: string[] })[];
  uploaded: { passengerId: string; type: string }[];
}): { uploaded: number; required: number } {
  const have = new Set(input.uploaded.map((slot) => `${slot.passengerId}|${slot.type}`));
  let uploaded = 0;
  let required = 0;
  for (const passengerId of input.passengerIds) {
    for (const entry of input.requiredTypes) {
      const { type, passengerIds } = typeof entry === "string" ? { type: entry, passengerIds: undefined } : entry;
      if (passengerIds && !passengerIds.includes(passengerId)) continue;
      required += 1;
      if (have.has(`${passengerId}|${type}`)) uploaded += 1;
    }
  }
  return { uploaded, required };
}
