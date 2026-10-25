import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { holdBookingSilently, setServiceStatus, type StatusNotification } from "../service-status/engine";
import { createTask } from "../tasks/create-task";
import { writeAudit } from "../audit/log";

/**
 * Client 2026-10-25 — "On Hold only for Return Ticket: a booking that comes in early waits until 24 hours before
 * travel, so the ticket isn't issued too soon". A paid Return Ticket booking whose travel date is after tomorrow goes
 * On Hold (internal, no customer message) until the day before travel; then it moves back to where it was and the
 * staff get a task to issue it. Until that day the ticket can't be sent to the airline / issued (Admin may override).
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOLD_EVENT_PREFIX = "RT_EARLY_HOLD:";
const RELEASE_EVENT = "RT_EARLY_RELEASE";

/** The IST calendar day of `now` as midnight UTC (travel dates are stored as calendar dates at midnight UTC). */
function todayIst(now: Date): number {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/** "2026-10-29" — the day the ticket may be issued: the day before travel. */
export function returnTicketIssueDay(travelDate: Date): string {
  return new Date(Date.UTC(travelDate.getUTCFullYear(), travelDate.getUTCMonth(), travelDate.getUTCDate()) - DAY_MS).toISOString().slice(0, 10);
}

/** True while it's still too early to issue: today (IST) is before the day before travel. No travel date = never early. */
export function isTooEarlyToIssue(travelDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!travelDate) return false;
  return todayIst(now) < Date.parse(`${returnTicketIssueDay(travelDate)}T00:00:00Z`);
}

/** The 409 message for an early send / issue, or null when it may go ahead. */
export function earlyIssueBlock(travelDate: Date | null | undefined, isAdmin: boolean, now: Date = new Date()): string | null {
  if (isAdmin || !travelDate || !isTooEarlyToIssue(travelDate, now)) return null;
  return `This Return Ticket can be issued from ${returnTicketIssueDay(travelDate)} (the day before travel). The booking stays On Hold until then.`;
}

/**
 * Hourly (staff-alerts): put early Return Ticket bookings On Hold, and release the ones whose issue day has come.
 * Returns how many were held / released.
 */
export async function runReturnTicketEarlyHolds(now: Date = new Date()): Promise<{ held: number; released: number }> {
  let held = 0;
  let released = 0;

  // 1. Hold: paid, not finished, not on hold, not yet sent to the airline, travel after tomorrow, never held before.
  const candidates = await db.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "PROCESSING"] },
      lead: { serviceType: "RETURN_TICKET", travelDate: { not: null } },
      serviceStatus: { isTerminal: false, blocksRefund: false, OR: [{ systemEvent: null }, { systemEvent: { notIn: ["ON_HOLD", "SENT_TO_AIRLINES", "RT_RESERVATION_ISSUED"] } }] },
    },
    select: { id: true, serviceStatusId: true, lead: { select: { travelDate: true } } },
    take: 200,
  });
  for (const booking of candidates) {
    if (!isTooEarlyToIssue(booking.lead.travelDate, now) || !booking.serviceStatusId) continue;
    const already = await db.automationReminderLog.findFirst({ where: { entityType: "Booking", entityId: booking.id, event: { startsWith: HOLD_EVENT_PREFIX } }, select: { id: true } });
    if (already) continue;
    const issueDay = returnTicketIssueDay(booking.lead.travelDate as Date);
    const moved = await db.$transaction(async (tx) => {
      const ok = await holdBookingSilently(tx, booking.id, "automatic hold", `Return Ticket waits until ${issueDay} (the day before travel) before it is issued`);
      // The status it came from rides on the log row, so the release can put it back.
      if (ok) await tx.automationReminderLog.create({ data: { event: `${HOLD_EVENT_PREFIX}${booking.serviceStatusId}`, entityType: "Booking", entityId: booking.id } });
      return ok;
    });
    if (moved) held++;
  }

  // 2. Release: early-held bookings still On Hold whose issue day has come.
  const holds = await db.automationReminderLog.findMany({ where: { entityType: "Booking", event: { startsWith: HOLD_EVENT_PREFIX } }, select: { event: true, entityId: true }, take: 500 });
  const notifications: (StatusNotification | null)[] = [];
  for (const hold of holds) {
    const releasedBefore = await db.automationReminderLog.findFirst({ where: { entityType: "Booking", entityId: hold.entityId, event: RELEASE_EVENT }, select: { id: true } });
    if (releasedBefore) continue;
    const booking = await db.booking.findUnique({
      where: { id: hold.entityId },
      select: { id: true, bookingId: true, leadId: true, serviceStatus: { select: { systemEvent: true } }, lead: { select: { travelDate: true } } },
    });
    if (!booking || isTooEarlyToIssue(booking.lead.travelDate, now)) continue;
    const previousStatusId = hold.event.slice(HOLD_EVENT_PREFIX.length);
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Staff may have moved it on by hand meanwhile — only a booking still On Hold goes back.
      if (booking.serviceStatus?.systemEvent === "ON_HOLD") {
        const moved = await setServiceStatus(tx, { scope: "BOOKING", entityId: booking.id, toStatusId: previousStatusId, actorLabel: "automatic release — the day before travel" });
        if (moved.ok) notifications.push(moved.notification);
        else await writeAudit(tx, { entityType: "Booking", entityId: booking.id, action: "RT_EARLY_RELEASE_FAILED", note: `Couldn't move back from On Hold: ${moved.error}` });
      }
      await createTask(tx, {
        type: "MANUAL_VERIFICATION",
        priority: "HIGH",
        title: `Issue Return Ticket ${booking.bookingId} — travel is tomorrow`,
        reason: "The Return Ticket was held until the day before travel. Send it to the airline and issue it now.",
        entityType: "Booking",
        entityId: booking.id,
        leadId: booking.leadId,
        bookingId: booking.id,
        serviceType: "RETURN_TICKET",
      });
      await tx.automationReminderLog.create({ data: { event: RELEASE_EVENT, entityType: "Booking", entityId: booking.id } });
    });
    released++;
  }
  // Moving back from On Hold is internal; the status it returns to has already been announced once.
  void notifications;
  return { held, released };
}
