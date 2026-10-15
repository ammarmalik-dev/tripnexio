import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Client doc 2026-10-15 (I6 / C7) — every document belongs to one lead, so a
 * lead and its booking show one shared set of documents and a new request
 * never shows an earlier request's uploads. The lead is the one given, else
 * the booking's, else the passenger's most recent lead (a lead-stage upload
 * happens right after that lead is created).
 */
export async function documentLeadId(
  client: Client,
  input: { leadId?: string | null; bookingId?: string | null; passengerId?: string | null }
): Promise<string | null> {
  if (input.leadId) return input.leadId;
  if (input.bookingId) {
    const booking = await client.booking.findUnique({ where: { id: input.bookingId }, select: { leadId: true } });
    if (booking) return booking.leadId;
  }
  if (input.passengerId) {
    const lead = await client.lead.findFirst({
      where: { details: { path: ["passengerIds"], array_contains: [input.passengerId] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return lead?.id ?? null;
  }
  return null;
}

/** The documents of a lead and its bookings — the one document set shown on the lead. */
export function leadDocumentsWhere(leadId: string): Prisma.DocumentWhereInput {
  return { OR: [{ leadId }, { booking: { leadId } }] };
}

/** A booking's "Booking Documents": its own, plus the ones uploaded with the request before it was booked. */
export function bookingDocumentsWhere(booking: { id: string; leadId: string }): Prisma.DocumentWhereInput {
  return { OR: [{ bookingId: booking.id }, { bookingId: null, leadId: booking.leadId }] };
}

/** The booking a document's status counts towards: its own, else its lead's latest live booking. */
export async function bookingIdForDocument(client: Client, document: { bookingId: string | null; leadId: string | null }): Promise<string | null> {
  if (document.bookingId) return document.bookingId;
  if (!document.leadId) return null;
  const booking = await client.booking.findFirst({
    where: { leadId: document.leadId, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return booking?.id ?? null;
}
