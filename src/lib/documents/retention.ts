import { db } from "../db";
import { writeAudit } from "../audit/log";
import { deleteUploadedFile } from "../storage/local-file-storage";

/**
 * P27 - client decision: EVERY document file is deleted after the Admin-set
 * number of days (SystemConfig.documentRetentionDays). No document type is
 * exempt: passport, visa, tickets, bank slips and delivered outputs alike.
 *
 * Scope:
 *  a. Files on a booking that is closed - BookingStatus COMPLETED /
 *     CANCELLED / REFUNDED, or its per-service status is marked terminal -
 *     once the booking's closing date is older than the retention window.
 *     Closing date = the latest status-change audit row on the booking
 *     (the move into the closed status), falling back to Booking.updatedAt.
 *  b. Intake uploads on leads that never became a booking (abandoned or
 *     lost): once every lead that references the passenger is closed
 *     (LOST/CLOSED) or has had no update for the retention window.
 *  c. Never a file belonging to an active lead or booking.
 *
 * Only the stored file is removed: the Document row stays with fileUrl =
 * null and purgedAt set (screens show "Deleted after retention period"),
 * and every purge writes an audit row. Bank-transfer slips are stored on
 * Payment.bankSlipUrl; their files go too and the URL is cleared.
 */
export const TERMINAL_BOOKING_STATUSES = ["COMPLETED", "CANCELLED", "REFUNDED"] as const;
const CLOSED_LEAD_STATUSES = ["LOST", "CLOSED"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PurgeDocument {
  id: string;
  type: string;
  fileUrl: string;
  bookingId: string | null;
  bookingRef: string | null;
  reason: string;
}

interface PurgeSlip {
  paymentId: string;
  bookingRef: string;
  fileUrl: string;
}

export interface RetentionPlan {
  retentionDays: number;
  cutoff: Date;
  documents: PurgeDocument[];
  bankSlips: PurgeSlip[];
  /** Documents looked at but kept because their case is still active or too recent. */
  keptActiveOrRecent: number;
}

async function closedBookingDates(bookingIds: string[]): Promise<Map<string, Date>> {
  const closedAt = new Map<string, Date>();
  for (let i = 0; i < bookingIds.length; i += 1000) {
    const chunk = bookingIds.slice(i, i + 1000);
    const rows = await db.auditTrail.groupBy({
      by: ["entityId"],
      where: { entityType: "Booking", entityId: { in: chunk }, action: { in: ["SERVICE_STATUS_CHANGE", "STATUS_CHANGE"] } },
      _max: { timestamp: true },
    });
    for (const row of rows) if (row._max.timestamp) closedAt.set(row.entityId, row._max.timestamp);
  }
  return closedAt;
}

/** Works out what the retention job would delete right now. Reads only. */
export async function planDocumentRetention(retentionDays: number, now: Date = new Date()): Promise<RetentionPlan> {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  const closedFilter = {
    OR: [{ status: { in: [...TERMINAL_BOOKING_STATUSES] } }, { serviceStatus: { isTerminal: true } }],
  };

  // a. Closed bookings that still hold files.
  const closedBookings = await db.booking.findMany({
    where: {
      AND: [
        closedFilter,
        {
          OR: [
            { documents: { some: { fileUrl: { not: null }, purgedAt: null } } },
            { payments: { some: { bankSlipUrl: { not: null } } } },
          ],
        },
      ],
    },
    select: { id: true, bookingId: true, updatedAt: true },
  });
  const auditClosedAt = await closedBookingDates(closedBookings.map((booking) => booking.id));
  const expiredBookings = new Map<string, string>();
  let keptActiveOrRecent = 0;
  for (const booking of closedBookings) {
    const closedAt = auditClosedAt.get(booking.id) ?? booking.updatedAt;
    if (closedAt <= cutoff) expiredBookings.set(booking.id, booking.bookingId);
    else keptActiveOrRecent++;
  }

  const documents: PurgeDocument[] = [];
  const bookingDocs = expiredBookings.size
    ? await db.document.findMany({
        where: { bookingId: { in: [...expiredBookings.keys()] }, fileUrl: { not: null }, purgedAt: null },
        select: { id: true, type: true, fileUrl: true, bookingId: true },
      })
    : [];
  for (const doc of bookingDocs) {
    documents.push({
      id: doc.id,
      type: doc.type,
      fileUrl: doc.fileUrl!,
      bookingId: doc.bookingId,
      bookingRef: expiredBookings.get(doc.bookingId!) ?? null,
      reason: "booking closed",
    });
  }
  const bankSlips: PurgeSlip[] = expiredBookings.size
    ? (
        await db.payment.findMany({
          where: { bookingId: { in: [...expiredBookings.keys()] }, bankSlipUrl: { not: null } },
          select: { id: true, bookingId: true, bankSlipUrl: true },
        })
      ).map((payment) => ({ paymentId: payment.id, bookingRef: expiredBookings.get(payment.bookingId) ?? payment.bookingId, fileUrl: payment.bankSlipUrl! }))
    : [];

  // b. Intake uploads with no booking (passport photos etc. from a lead that never converted).
  const intakeDocs = await db.document.findMany({
    where: { bookingId: null, passengerId: { not: null }, fileUrl: { not: null }, purgedAt: null },
    select: { id: true, type: true, fileUrl: true, passengerId: true, updatedAt: true },
  });
  const passengerIds = [...new Set(intakeDocs.map((doc) => doc.passengerId!))];
  const passengerClosed = new Map<string, boolean>();
  for (const passengerId of passengerIds) {
    // An active booking for this passenger anywhere keeps their files.
    const activeBooking = await db.bookingPassenger.findFirst({
      where: {
        passengerId,
        booking: { status: { notIn: [...TERMINAL_BOOKING_STATUSES] }, OR: [{ serviceStatusId: null }, { serviceStatus: { isTerminal: false } }] },
      },
      select: { id: true },
    });
    if (activeBooking) {
      passengerClosed.set(passengerId, false);
      continue;
    }
    const leads = await db.lead.findMany({
      where: { details: { path: ["passengerIds"], array_contains: [passengerId] } },
      select: { status: true, updatedAt: true, bookings: { select: { id: true } } },
    });
    // Every lead referencing the passenger must have no booking (a booked
    // lead's files follow rule a) and be lost/closed or idle for the whole
    // window; a closed lead also waits the window after its last update.
    // A passenger no lead references is left alone (nothing to date it by).
    const allClosed =
      leads.length > 0 &&
      leads.every(
        (lead) =>
          lead.bookings.length === 0 &&
          lead.updatedAt <= cutoff &&
          ((CLOSED_LEAD_STATUSES as readonly string[]).includes(lead.status) || lead.status !== "CONVERTED")
      );
    passengerClosed.set(passengerId, allClosed);
  }
  for (const doc of intakeDocs) {
    if (passengerClosed.get(doc.passengerId!) && doc.updatedAt <= cutoff) {
      documents.push({ id: doc.id, type: doc.type, fileUrl: doc.fileUrl!, bookingId: null, bookingRef: null, reason: "lead never became a booking" });
    } else {
      keptActiveOrRecent++;
    }
  }

  return { retentionDays, cutoff, documents, bankSlips, keptActiveOrRecent };
}

/** Deletes what the plan lists. Each purge is audited before the file is removed. */
export async function executeDocumentRetention(plan: RetentionPlan): Promise<{ documentsPurged: number; bankSlipsPurged: number }> {
  let documentsPurged = 0;
  for (const doc of plan.documents) {
    await writeAudit(db, {
      entityType: "Document",
      entityId: doc.id,
      action: "PURGE",
      note: `File deleted after the ${plan.retentionDays}-day retention period (type "${doc.type}", ${doc.bookingRef ? `booking ${doc.bookingRef}` : "no booking"}; ${doc.reason})`,
    });
    // Detach first: deleteUploadedFile keeps a file another live record still references.
    await db.document.update({ where: { id: doc.id }, data: { fileUrl: null, purgedAt: new Date() } });
    await deleteUploadedFile(doc.fileUrl);
    documentsPurged++;
  }
  let bankSlipsPurged = 0;
  for (const slip of plan.bankSlips) {
    await writeAudit(db, {
      entityType: "Payment",
      entityId: slip.paymentId,
      action: "PURGE",
      note: `Bank-transfer slip deleted after the ${plan.retentionDays}-day retention period (booking ${slip.bookingRef})`,
    });
    await db.payment.update({ where: { id: slip.paymentId }, data: { bankSlipUrl: null } });
    await deleteUploadedFile(slip.fileUrl);
    bankSlipsPurged++;
  }
  return { documentsPurged, bankSlipsPurged };
}
