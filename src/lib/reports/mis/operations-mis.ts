import { db } from "../../db";
import { getOpenDelayRecords } from "../../crm/delays";
import { bookingScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportResult } from "../types";
import type { ServiceType } from "../../../generated/prisma/enums";
import { ALL_SERVICE_TYPES, bucket, capRows, daysBetween, inChunks, loadBookingLeadIds, loadLeadMeta, serviceLabel, totalsFor } from "./shared";

interface OpsAcc {
  created: number;
  completed: number;
  cancelled: number;
  inProgress: number;
  delayed: number;
  completedInRange: number;
  completionDays: number;
  documentsPending: number;
}

const emptyAcc = (): OpsAcc => ({ created: 0, completed: 0, cancelled: 0, inProgress: 0, delayed: 0, completedInRange: 0, completionDays: 0, documentsPending: 0 });

const columns: ReportColumn[] = [
  { key: "service", label: "Service", kind: "text" },
  { key: "bookingsCreated", label: "Bookings created", kind: "number" },
  { key: "completed", label: "Completed", kind: "number" },
  { key: "cancelled", label: "Cancelled / refunded", kind: "number" },
  { key: "inProgress", label: "In progress", kind: "number" },
  { key: "delayed", label: "Delayed (open now)", kind: "number" },
  { key: "completedInRange", label: "Completions in range", kind: "number" },
  { key: "averageCompletionDays", label: "Avg completion (days)", kind: "number" },
  { key: "documentsPending", label: "Docs pending verification", kind: "number" },
];

async function run(filters: ReportFilters): Promise<ReportResult> {
  const bookingScope = await bookingScopeWhere(filters);
  const range = { gte: filters.from, lt: filters.to };
  const byService = new Map<ServiceType, OpsAcc>();

  // 1. Bookings created in range, by current status.
  const statusGroups = await db.booking.findMany({
    where: { ...bookingScope, createdAt: range },
    select: { leadId: true, status: true },
  });

  // 2. Completions in range: the booking-status audit row that moved it to COMPLETED.
  const completionAudits = await db.auditTrail.findMany({
    where: { entityType: "Booking", action: { in: ["SERVICE_STATUS_CHANGE", "STATUS_CHANGE"] }, note: { contains: "-> COMPLETED" }, timestamp: range },
    select: { entityId: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });
  const completedAt = new Map<string, Date>(); // latest completion in range per booking
  for (const audit of completionAudits) completedAt.set(audit.entityId, audit.timestamp);
  const completedBookings = await inChunks(completedAt.keys(), (chunk) =>
    db.booking.findMany({ where: { ...bookingScope, id: { in: chunk }, status: "COMPLETED" }, select: { id: true, leadId: true, createdAt: true } })
  );

  // 3. Open delays right now (same definition as /crm/delays), restricted to in-scope bookings.
  const openDelays = await getOpenDelayRecords();
  const delayedIds = [...new Set(openDelays.map((record) => record.bookingId))];
  const delayedBookings = await inChunks(delayedIds, (chunk) =>
    db.booking.findMany({ where: { ...bookingScope, id: { in: chunk } }, select: { id: true, leadId: true } })
  );

  // 4. Documents currently uploaded and awaiting verification, on in-scope, non-cancelled bookings.
  const pendingDocs = await db.document.findMany({
    where: { status: "RECEIVED", booking: { ...bookingScope, status: { notIn: ["CANCELLED", "REFUNDED"] } } },
    select: { bookingId: true },
  });
  const docLeadByBooking = await loadBookingLeadIds(pendingDocs.flatMap((doc) => (doc.bookingId ? [doc.bookingId] : [])));

  const leadMeta = await loadLeadMeta([
    ...statusGroups.map((booking) => booking.leadId),
    ...completedBookings.map((booking) => booking.leadId),
    ...delayedBookings.map((booking) => booking.leadId),
    ...docLeadByBooking.values(),
  ]);
  const accFor = (leadId: string | undefined): OpsAcc | null => {
    const meta = leadId ? leadMeta.get(leadId) : undefined;
    return meta ? bucket(byService, meta.serviceType, emptyAcc) : null;
  };

  for (const booking of statusGroups) {
    const acc = accFor(booking.leadId);
    if (!acc) continue;
    acc.created += 1;
    if (booking.status === "COMPLETED") acc.completed += 1;
    else if (booking.status === "CANCELLED" || booking.status === "REFUNDED") acc.cancelled += 1;
    else acc.inProgress += 1;
  }
  for (const booking of completedBookings) {
    const acc = accFor(booking.leadId);
    const at = completedAt.get(booking.id);
    if (!acc || !at) continue;
    acc.completedInRange += 1;
    acc.completionDays += Math.max(0, daysBetween(booking.createdAt, at));
  }
  for (const booking of delayedBookings) {
    const acc = accFor(booking.leadId);
    if (acc) acc.delayed += 1;
  }
  for (const doc of pendingDocs) {
    const acc = doc.bookingId ? accFor(docLeadByBooking.get(doc.bookingId)) : null;
    if (acc) acc.documentsPending += 1;
  }

  const rows: Record<string, ReportCell>[] = ALL_SERVICE_TYPES.filter((serviceType) => byService.has(serviceType)).map((serviceType) => {
    const acc = byService.get(serviceType) ?? emptyAcc();
    return {
      service: serviceLabel(serviceType),
      bookingsCreated: acc.created,
      completed: acc.completed,
      cancelled: acc.cancelled,
      inProgress: acc.inProgress,
      delayed: acc.delayed,
      completedInRange: acc.completedInRange,
      averageCompletionDays: acc.completedInRange > 0 ? round2(acc.completionDays / acc.completedInRange) : null,
      documentsPending: acc.documentsPending,
    };
  });

  const totals = totalsFor(columns, rows);
  let allCompleted = 0;
  let allDays = 0;
  for (const acc of byService.values()) {
    allCompleted += acc.completedInRange;
    allDays += acc.completionDays;
  }
  totals.averageCompletionDays = allCompleted > 0 ? round2(allDays / allCompleted) : null;

  const notes = [
    "Bookings created / Completed / Cancelled / In progress: bookings whose createdAt is in the range, split by their CURRENT status (Cancelled includes REFUNDED; In progress = PENDING, CONFIRMED, PROCESSING).",
    "Delayed (open now): a live snapshot, not date-filtered - distinct in-scope bookings with an open Completion-SLA or Document-verification-SLA delay, using the same definition and Admin SLA hours as /crm/delays.",
    "Completions in range / Avg completion: bookings now COMPLETED whose status-change audit row moving them to COMPLETED has a timestamp in the range; completion time = that timestamp - booking createdAt, in days.",
    "Docs pending verification: a live snapshot - documents currently RECEIVED (uploaded, awaiting staff verification) on in-scope bookings that aren't cancelled/refunded.",
  ];
  const capped = capRows(rows, notes);
  return { columns, rows: capped, totals, notes };
}

export const operationsMisReport: ReportDefinition = {
  key: "operations-mis",
  title: "Operations MIS",
  group: "mis",
  description: "Per service: bookings created, completed, cancelled, in progress, delayed, average completion time and documents pending verification.",
  supportedFilters: ["serviceType", "countryId", "staffId", "vendorId"],
  run,
};
