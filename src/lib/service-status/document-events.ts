import type { Prisma } from "../../generated/prisma/client";
import { applySystemEvent, type StatusNotification } from "./engine";
import type { ServiceStatusSystemEvent } from "./events";
import { OUTPUT_TYPES } from "../outputs/output-types";
import { bookingDocumentsWhere } from "../documents/document-lead";

/**
 * P08 — after any write to a booking's documents, moves the booking's
 * per-service status to match the documents as a whole (client doc 2026-10-20):
 *   - something uploaded and waiting for staff (RECEIVED)        -> DOCUMENTS_RECEIVED ("Documents Uploaded")
 *   - review done, something rejected                             -> DOCUMENTS_REJECTED ("Documents Required")
 *   - something still to upload (REQUIRED / MISSING)              -> DOCUMENTS_REQUESTED ("Documents Pending")
 *   - every document verified                                     -> DOCUMENTS_VALIDATED
 * so the customer hears once per review round, never per document. applySystemEvent only moves back
 * within the document stage; past it (e.g. Applied to Embassy) received / validated documents are the
 * "additional" ones.
 */
export async function applyBookingDocumentEvent(
  tx: Prisma.TransactionClient,
  bookingId: string | null | undefined,
  actor: { userId?: string; actorLabel: string }
): Promise<StatusNotification[]> {
  if (!bookingId) return [];
  // Only the customer's own documents — delivered outputs (visa, ticket...) aren't part of "documents received/validated".
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, leadId: true } });
  if (!booking) return [];
  // Client doc 2026-10-15 (I6) — the booking's documents include those uploaded with the request.
  const documents = await tx.document.findMany({
    where: { AND: [bookingDocumentsWhere(booking), { type: { notIn: [...OUTPUT_TYPES] }, purgedAt: null }] },
    select: { status: true },
  });
  if (documents.length === 0) return [];

  let event: ServiceStatusSystemEvent;
  if (documents.some((document) => document.status === "RECEIVED")) event = "DOCUMENTS_RECEIVED";
  else if (documents.some((document) => document.status === "REJECTED")) event = "DOCUMENTS_REJECTED";
  else if (documents.some((document) => document.status === "REQUIRED" || document.status === "MISSING")) event = "DOCUMENTS_REQUESTED";
  else event = "DOCUMENTS_VALIDATED";

  let notification = await applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event, ...actor });
  // A service without a separate "Documents Required" status (e.g. Special Fare) uses its Documents Pending one.
  if (!notification && event === "DOCUMENTS_REJECTED") {
    notification = await applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event: "DOCUMENTS_REQUESTED", ...actor });
  }
  return notification ? [notification] : [];
}
