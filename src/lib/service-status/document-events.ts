import type { Prisma } from "../../generated/prisma/client";
import { applySystemEvent, type StatusNotification } from "./engine";
import type { ServiceStatusSystemEvent } from "./events";
import { OUTPUT_TYPES } from "../outputs/output-types";

/**
 * P08 — after any write to a booking's documents, moves the booking's
 * per-service status to match the documents as a whole:
 *   - something still to upload (REQUIRED / MISSING / REJECTED) -> DOCUMENTS_REQUESTED
 *   - everything uploaded, not all verified yet                  -> DOCUMENTS_RECEIVED
 *   - every document verified                                     -> DOCUMENTS_VALIDATED
 * applySystemEvent is forward-only, so a later request for one more document
 * never pulls a booking that's already further along back down.
 */
export async function applyBookingDocumentEvent(
  tx: Prisma.TransactionClient,
  bookingId: string | null | undefined,
  actor: { userId?: string; actorLabel: string }
): Promise<StatusNotification[]> {
  if (!bookingId) return [];
  // Only the customer's own documents — delivered outputs (visa, ticket...) aren't part of "documents received/validated".
  const documents = await tx.document.findMany({ where: { bookingId, type: { notIn: [...OUTPUT_TYPES] } }, select: { status: true } });
  if (documents.length === 0) return [];

  let event: ServiceStatusSystemEvent;
  if (documents.some((document) => document.status === "REQUIRED" || document.status === "MISSING" || document.status === "REJECTED")) {
    event = "DOCUMENTS_REQUESTED";
  } else if (documents.every((document) => document.status === "VERIFIED")) {
    event = "DOCUMENTS_VALIDATED";
  } else {
    event = "DOCUMENTS_RECEIVED";
  }

  const notification = await applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event, ...actor });
  return notification ? [notification] : [];
}
