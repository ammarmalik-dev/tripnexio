import { db } from "../db";
import { getOutstandingDocuments, type OutstandingDocument } from "./outstanding-documents";

export interface PendingPaymentItem {
  bookingId: string;
  bookingDbId: string;
  payHref: string;
}

/** Client corrections 2026-10-05 — "Action Required": documents to upload and bookings still waiting for payment. */
export async function getActionRequired(customerId: string): Promise<{ documents: OutstandingDocument[]; payments: PendingPaymentItem[] }> {
  const [documents, unpaid] = await Promise.all([
    getOutstandingDocuments(customerId),
    db.booking.findMany({
      where: { customerId, status: "PENDING", customerToken: { not: null } },
      select: { id: true, bookingId: true, customerToken: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    documents,
    payments: unpaid.map((booking) => ({ bookingId: booking.bookingId, bookingDbId: booking.id, payHref: `/pay/${booking.customerToken}` })),
  };
}
