import { db } from "../db";
import { isCheckoutService, resolveCheckoutDocumentTypes } from "../checkout/required-documents";
import { OUTPUT_TYPES } from "../outputs/output-types";

/**
 * Client doc 2026-10-20 (B4) — a paid booking shows every configured document for every passenger (New Visa,
 * OTB, Return Ticket, Special Fare, Visa Change), uploaded or not, so staff can upload any of them from CRM
 * and see each one's status. Creates the missing "Pending" (REQUIRED) slots; never touches existing ones.
 * Idempotent; returns how many slots it created. Runs outside any transaction (it reads Admin config).
 */
export async function ensureRequiredDocumentSlots(bookingId: string): Promise<number> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      leadId: true,
      customerId: true,
      linkedBookingId: true,
      status: true,
      lead: { select: { serviceType: true, details: true } },
      passengers: { select: { passengerId: true } },
    },
  });
  if (!booking || booking.status === "PENDING" || !isCheckoutService(booking.lead.serviceType) || booking.passengers.length === 0) return 0;
  const types = (await resolveCheckoutDocumentTypes(booking)).filter((type) => type.required && !(OUTPUT_TYPES as readonly string[]).includes(type.type));
  if (types.length === 0) return 0;
  const existing = await db.document.findMany({
    where: { passengerId: { in: booking.passengers.map((row) => row.passengerId) }, OR: [{ bookingId }, { bookingId: null, leadId: booking.leadId }] },
    select: { passengerId: true, type: true },
  });
  const have = new Set(existing.map((doc) => `${doc.passengerId}|${doc.type}`));
  const missing = booking.passengers.flatMap((row) => types.filter((type) => !have.has(`${row.passengerId}|${type.type}`)).map((type) => ({ passengerId: row.passengerId, type: type.type })));
  if (missing.length === 0) return 0;
  await db.document.createMany({
    data: missing.map((slot) => ({ bookingId, leadId: booking.leadId, passengerId: slot.passengerId, type: slot.type, status: "REQUIRED" as const })),
  });
  return missing.length;
}
