import { db } from "../../db";
import { paymentTotal } from "../../payments/totals";
import { leadScopeWhere, paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportDefinition } from "../types";
import {
  ALL_FILTERS,
  SOURCE_LIMIT,
  capRows,
  findInChunks,
  inRange,
  isoDate,
  loadBookingInfo,
  loadUserNames,
  num,
  serviceLabel,
  sourceLimitNote,
  sumColumns,
} from "./shared";

/** Separator written by withReason() (src/lib/validation/sensitive-action.ts). */
const REASON_MARKER = " — reason: ";

function reasonFromNote(note: string | null): string {
  if (!note) return "";
  const index = note.indexOf(REASON_MARKER);
  // The audit note is "<from> -> SUCCESS (<actor> — reason: <reason>)" - drop the closing paren.
  return index >= 0 ? note.slice(index + REASON_MARKER.length).replace(/\)\s*$/, "") : note;
}

interface LedgerEntry {
  at: Date;
  type: string;
  bookingRowId: string | null;
  added: number | null;
  deducted: number | null;
  approved: number | null;
  reason: string;
  byUserId: string | null;
}

export const financialAdjustmentsReport: ReportDefinition = {
  key: "financial-adjustments",
  title: "Financial Adjustments",
  group: "finance",
  description: "Combined ledger of extra payments, manual / bank-transfer approvals, refunds and coupon discounts.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const paymentScope = await paymentScopeWhere(filters);
    const lead = await leadScopeWhere(filters);
    const entries: LedgerEntry[] = [];

    // 1) Extra payments and coupon discounts on successful payments.
    const payments = await db.payment.findMany({
      where: {
        AND: [
          paymentScope,
          { status: "SUCCESS", updatedAt: inRange(filters) },
          { OR: [{ purpose: "EXTRA" }, { couponDiscount: { gt: 0 } }] },
        ],
      },
      select: {
        id: true,
        bookingId: true,
        updatedAt: true,
        purpose: true,
        description: true,
        couponCode: true,
        amount: true,
        couponDiscount: true,
        gstAmount: true,
        gatewayFee: true,
      },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(payments.length, notes);
    const extraIds = payments.filter((payment) => payment.purpose === "EXTRA").map((payment) => payment.id);
    const createAudits = await findInChunks(extraIds, (ids) =>
      db.auditTrail.findMany({
        where: { entityType: "Payment", action: "CREATE", entityId: { in: ids } },
        select: { entityId: true, byUserId: true },
      })
    );
    const creatorByPayment = new Map(createAudits.map((audit) => [audit.entityId, audit.byUserId]));
    for (const payment of payments) {
      if (payment.purpose === "EXTRA") {
        entries.push({
          at: payment.updatedAt,
          type: "Extra payment",
          bookingRowId: payment.bookingId,
          added: paymentTotal(payment),
          deducted: null,
          approved: null,
          reason: payment.description ?? "",
          byUserId: creatorByPayment.get(payment.id) ?? null,
        });
      }
      const coupon = num(payment.couponDiscount);
      if (coupon > 0) {
        entries.push({
          at: payment.updatedAt,
          type: "Coupon discount",
          bookingRowId: payment.bookingId,
          added: null,
          deducted: round2(coupon),
          approved: null,
          reason: payment.couponCode ? `Coupon ${payment.couponCode}` : "Coupon",
          byUserId: null,
        });
      }
    }

    // 2) Manual mark-success overrides and bank-transfer approvals (audit rows written by completePaymentSuccess).
    const approvals = await db.auditTrail.findMany({
      where: {
        entityType: "Payment",
        action: "STATUS_CHANGE",
        timestamp: inRange(filters),
        AND: [{ note: { contains: "-> SUCCESS" } }, { OR: [{ note: { contains: "manual override" } }, { note: { contains: "bank-transfer approved" } }] }],
      },
      select: { entityId: true, timestamp: true, note: true, byUserId: true },
      orderBy: { timestamp: "asc" },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(approvals.length, notes);
    const approvedPayments = await findInChunks(
      approvals.map((audit) => audit.entityId),
      (ids) =>
        db.payment.findMany({
          where: { AND: [paymentScope, { id: { in: ids } }] },
          select: { id: true, bookingId: true, amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true },
        })
    );
    const approvedById = new Map(approvedPayments.map((payment) => [payment.id, payment]));
    for (const audit of approvals) {
      const payment = approvedById.get(audit.entityId);
      if (!payment) continue; // outside the report's scope filters
      const isBankTransfer = (audit.note ?? "").includes("bank-transfer approved");
      entries.push({
        at: audit.timestamp,
        type: isBankTransfer ? "Bank transfer approved" : "Manual mark-success",
        bookingRowId: payment.bookingId,
        added: null,
        deducted: null,
        approved: paymentTotal(payment),
        reason: reasonFromNote(audit.note),
        byUserId: audit.byUserId,
      });
    }

    // 3) Refunds (COMPLETED dated by updatedAt, PENDING/PROCESSING by createdAt; REJECTED excluded).
    const refunds = await db.refund.findMany({
      where: {
        AND: [
          Object.keys(lead).length ? { payment: { booking: { lead } } } : {},
          {
            OR: [
              { status: "COMPLETED", updatedAt: inRange(filters) },
              { status: { in: ["PENDING", "PROCESSING"] }, createdAt: inRange(filters) },
            ],
          },
        ],
      },
      select: { paymentId: true, status: true, createdAt: true, updatedAt: true, refundAmount: true, reason: true, raisedByUserId: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(refunds.length, notes);
    const refundPayments = await findInChunks(
      refunds.map((refund) => refund.paymentId),
      (ids) => db.payment.findMany({ where: { id: { in: ids } }, select: { id: true, bookingId: true } })
    );
    const bookingByPayment = new Map(refundPayments.map((payment) => [payment.id, payment.bookingId]));
    for (const refund of refunds) {
      const completed = refund.status === "COMPLETED";
      entries.push({
        at: completed ? refund.updatedAt : refund.createdAt,
        type: completed ? "Refund (completed)" : `Refund (${refund.status === "PENDING" ? "pending" : "processing"})`,
        bookingRowId: bookingByPayment.get(refund.paymentId) ?? null,
        added: null,
        deducted: round2(num(refund.refundAmount)),
        approved: null,
        reason: refund.reason ?? "",
        byUserId: refund.raisedByUserId,
      });
    }

    entries.sort((a, b) => a.at.getTime() - b.at.getTime());
    const info = await loadBookingInfo(entries.map((entry) => entry.bookingRowId).filter((id): id is string => id !== null));
    const users = await loadUserNames(entries.map((entry) => entry.byUserId));

    const rows: Record<string, ReportCell>[] = entries.map((entry) => {
      const booking = entry.bookingRowId ? info.get(entry.bookingRowId) : undefined;
      return {
        date: isoDate(entry.at),
        type: entry.type,
        bookingId: booking?.reference ?? null,
        customer: booking?.customerName ?? null,
        service: booking ? serviceLabel(booking.serviceType) : null,
        added: entry.added,
        deducted: entry.deducted,
        approved: entry.approved,
        reason: entry.reason,
        by: entry.byUserId ? users.get(entry.byUserId) ?? null : null,
      };
    });

    notes.push(
      "Extra payments and coupon discounts: SUCCESS payments dated by payment.updatedAt. Extra = customer-payable total of payments with purpose EXTRA (fare differences etc.); 'by' is the staff member who raised it.",
      "Manual mark-success / bank-transfer approvals: the Payment STATUS_CHANGE -> SUCCESS audit rows written by those staff actions, dated by the audit timestamp. 'Approved' is that payment's total - it confirms money already counted elsewhere, so it is kept in its own column rather than added to the others (an approved EXTRA payment appears on both an 'Extra payment' and an approval row).",
      "Refunds: COMPLETED dated by refund.updatedAt, PENDING/PROCESSING by createdAt; REJECTED refunds are excluded. 'By' is the staff member who raised it.",
      "Added, Deducted and Approved are totalled separately - they aren't a single net balance."
    );
    return {
      columns: [
        { key: "date", label: "Date", kind: "date" },
        { key: "type", label: "Type", kind: "text" },
        { key: "bookingId", label: "Booking", kind: "text" },
        { key: "customer", label: "Customer", kind: "text" },
        { key: "service", label: "Service", kind: "text" },
        { key: "added", label: "Added", kind: "money" },
        { key: "deducted", label: "Deducted", kind: "money" },
        { key: "approved", label: "Approved", kind: "money" },
        { key: "reason", label: "Reason / note", kind: "text" },
        { key: "by", label: "By", kind: "text" },
      ],
      rows: capRows(rows, notes),
      totals: sumColumns(rows, ["added", "deducted", "approved"]),
      notes,
    };
  },
};
