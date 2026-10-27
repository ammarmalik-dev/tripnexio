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
 *
 * Client doc 2026-10-27 (C11) — "Documents Uploaded / Received" is internal only: the status still moves
 * (staff see it) but no customer message goes out for an upload. The customer gets ONE message when the
 * whole set is validated, or when the round ends with something rejected / still needed (that message lists
 * per passenger which documents are needed). A further upload while the booking already shows "Documents
 * Uploaded" doesn't move it on to "Additional Documents Received", and validating part of a set the customer
 * is still uploading (back to "Documents Pending") sends nothing either.
 */
export async function applyBookingDocumentEvent(
  tx: Prisma.TransactionClient,
  bookingId: string | null | undefined,
  actor: { userId?: string; actorLabel: string }
): Promise<StatusNotification[]> {
  if (!bookingId) return [];
  // Only the customer's own documents — delivered outputs (visa, ticket...) aren't part of "documents received/validated".
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, leadId: true, serviceStatus: { select: { systemEvent: true } } } });
  if (!booking) return [];
  // Client doc 2026-10-15 (I6) — the booking's documents include those uploaded with the request.
  const documents = await tx.document.findMany({
    where: { AND: [bookingDocumentsWhere(booking), { type: { notIn: [...OUTPUT_TYPES] }, purgedAt: null }] },
    select: { status: true },
  });
  if (documents.length === 0) return [];

  const event = documentSetEvent(documents.map((document) => document.status));
  const current = booking.serviceStatus?.systemEvent ?? null;
  if (current === event) return [];

  let notification = await applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event, ...actor, silent: isQuietDocumentMove(event, current, documents.map((document) => document.status)) });
  // A service without a separate "Documents Required" status (e.g. Special Fare) uses its Documents Pending one.
  if (!notification && event === "DOCUMENTS_REJECTED") {
    notification = await applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event: "DOCUMENTS_REQUESTED", ...actor });
  }
  return notification ? [notification] : [];
}

/** The booking's document-stage event for its customer documents' statuses as a whole (pure; see above). */
export function documentSetEvent(statuses: string[]): ServiceStatusSystemEvent {
  if (statuses.some((status) => status === "RECEIVED")) return "DOCUMENTS_RECEIVED";
  if (statuses.some((status) => status === "REJECTED")) return "DOCUMENTS_REJECTED";
  if (statuses.some((status) => status === "REQUIRED" || status === "MISSING")) return "DOCUMENTS_REQUESTED";
  return "DOCUMENTS_VALIDATED";
}

/** Client doc 2026-10-27 (C11) — upload events move the status for staff but never message the customer. */
export function isInternalDocumentEvent(event: ServiceStatusSystemEvent): boolean {
  return event === "DOCUMENTS_RECEIVED" || event === "ADDITIONAL_DOCUMENTS_RECEIVED";
}

/**
 * Client doc 2026-10-27 (C11) — status moves that stay internal: an upload, and staff validating part of a set
 * while the rest is simply not uploaded yet (Uploaded → Pending, nothing rejected or flagged missing). A rejection,
 * a missing flag, a staff document request or the fully validated set still reach the customer (one message).
 */
export function isQuietDocumentMove(event: ServiceStatusSystemEvent, currentEvent: string | null, statuses: string[]): boolean {
  if (isInternalDocumentEvent(event)) return true;
  const fromUploaded = currentEvent === "DOCUMENTS_RECEIVED" || currentEvent === "ADDITIONAL_DOCUMENTS_RECEIVED";
  return event === "DOCUMENTS_REQUESTED" && fromUploaded && !statuses.some((status) => status === "MISSING");
}
