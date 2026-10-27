import type { Prisma } from "../../generated/prisma/client";
import { bookingDocumentsWhere } from "../documents/document-lead";
import { isOutputType } from "../outputs/output-types";

/**
 * Client doc 2026-10-27 (C1) — a booking may be applied / sent to the airline only once every customer
 * document of every passenger still travelling is validated. One slot = passenger × document type; the
 * slot's latest row decides it (a rejected copy that was re-uploaded and validated counts as validated).
 * Delivered outputs, purged files and the documents of a cancelled passenger don't count. With no customer
 * document at all, nothing has been validated yet.
 */
export interface ReadinessDocument {
  type: string;
  status: string;
  passengerId?: string | null;
  createdAt?: Date | string | null;
  purgedAt?: Date | string | null;
}

export const DOCUMENTS_NOT_VALIDATED = "Validate every passenger's documents first (Documents & PAX).";

/** Null when every slot's latest document is VERIFIED; otherwise why not. Pure, for the tests and the CRM. */
export function documentsValidatedBlock(documents: ReadinessDocument[], cancelledPassengerIds: Iterable<string> = []): string | null {
  const cancelled = new Set(cancelledPassengerIds);
  const latest = new Map<string, ReadinessDocument>();
  for (const document of documents) {
    if (isOutputType(document.type) || document.purgedAt) continue;
    if (document.passengerId && cancelled.has(document.passengerId)) continue;
    const key = `${document.passengerId ?? "-"}|${document.type}`;
    const current = latest.get(key);
    const time = (value: Date | string | null | undefined) => (value ? new Date(value).getTime() : 0);
    if (!current || time(document.createdAt) >= time(current.createdAt)) latest.set(key, document);
  }
  if (latest.size === 0) return DOCUMENTS_NOT_VALIDATED;
  const pending = [...latest.values()].filter((document) => document.status !== "VERIFIED").length;
  return pending > 0 ? `${pending} document${pending === 1 ? " isn't" : "s aren't"} validated yet — ${DOCUMENTS_NOT_VALIDATED}` : null;
}

/** Loads the booking's documents and cancelled passengers (works with `db` or an open `tx`). */
export async function bookingDocumentsValidatedBlock(client: Prisma.TransactionClient, bookingId: string): Promise<string | null> {
  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, leadId: true, passengers: { where: { outcome: "CANCELLED" }, select: { passengerId: true } } },
  });
  if (!booking) return "Booking not found.";
  const documents = await client.document.findMany({
    where: bookingDocumentsWhere(booking),
    select: { type: true, status: true, passengerId: true, createdAt: true, purgedAt: true },
  });
  return documentsValidatedBlock(documents, booking.passengers.map((row) => row.passengerId));
}
