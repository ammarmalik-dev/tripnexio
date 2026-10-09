import { notifyCustomerRefund } from "../refunds/notify-customer";
import { db } from "../db";
import { leadReference } from "../leads/reference";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { paymentTotal } from "../payments/totals";
import { formatCurrency } from "../format-currency";
import { notifyStaff, type NotifyStaffInput } from "./notify";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P22 — the event-specific wrappers around notifyStaff() used by the
 * existing code paths (CRM.md §26). Each one looks up what it needs by id
 * with the global `db`, so every one of them must be called AFTER the
 * triggering transaction commits. Like notifyStaff itself, none of these
 * ever throw — a failed staff notification never fails the business action.
 */

interface LeadForRecipients {
  assignedStaffId: string | null;
  serviceType: ServiceType;
}

/** The lead's assigned staff member if there is one, otherwise everyone with `permission` for that service. */
export function leadOwnerOrPermission(lead: LeadForRecipients, permission: string): NotifyStaffInput["recipients"] {
  return lead.assignedStaffId ? { userIds: [lead.assignedStaffId] } : { permission, serviceType: lead.serviceType };
}

async function safely(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[staff-notifications] ${label} failed`, error);
  }
}

const leadSelect = { id: true, reference: true, serviceType: true, assignedStaffId: true } as const;

/** NEW_BOOKING — a booking was just created (staff CRM, customer quote approval, or automatic checkout). */
export async function notifyNewBooking(bookingId: string): Promise<void> {
  await safely("NEW_BOOKING", async () => {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, bookingId: true, customer: { select: { name: true } }, lead: { select: leadSelect } },
    });
    if (!booking) return;
    await notifyStaff({
      type: "NEW_BOOKING",
      title: `New booking — ${SERVICE_TYPE_LABELS[booking.lead.serviceType]}`,
      body: `${booking.customer.name} · lead ${leadReference(booking.lead)}`,
      link: `/crm/bookings/${booking.id}`,
      entityType: "Booking",
      entityId: booking.id,
      recipients: leadOwnerOrPermission(booking.lead, "bookings.view"),
    });
  });
}

/** QUOTATION_ACCEPTED — the customer approved one of their quote options on the website. */
export async function notifyQuotationAccepted(leadId: string, quotationId: string): Promise<void> {
  await safely("QUOTATION_ACCEPTED", async () => {
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      select: { ...leadSelect, customer: { select: { name: true } } },
    });
    if (!lead) return;
    await notifyStaff({
      type: "QUOTATION_ACCEPTED",
      title: `Quotation accepted — ${leadReference(lead)}`,
      body: `${lead.customer.name} approved a quote for ${SERVICE_TYPE_LABELS[lead.serviceType]}.`,
      link: `/crm/leads/${lead.id}`,
      entityType: "Quotation",
      entityId: quotationId,
      recipients: leadOwnerOrPermission(lead, "leads.view"),
    });
  });
}

/** PAYMENT_RECEIVED — a payment just moved to SUCCESS (gateway webhook, manual mark-success, bank transfer, demo pay). */
export async function notifyStaffPaymentReceived(paymentId: string): Promise<void> {
  await safely("PAYMENT_RECEIVED", async () => {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        couponDiscount: true,
        gstAmount: true,
        gatewayFee: true,
        booking: { select: { id: true, bookingId: true, customer: { select: { name: true } }, lead: { select: leadSelect } } },
      },
    });
    if (!payment) return;
    const { booking } = payment;
    await notifyStaff({
      type: "PAYMENT_RECEIVED",
      title: `Payment received — ${formatCurrency(paymentTotal(payment), "INR")}`,
      body: `${booking.customer.name} · booking ${booking.bookingId}`,
      link: `/crm/bookings/${booking.id}`,
      entityType: "Payment",
      entityId: payment.id,
      recipients: leadOwnerOrPermission(booking.lead, "payments.view"),
    });
  });
}

/** DOCUMENT_UPLOADED — the customer uploaded (or reused) a document on their /pay/<token> page. */
export async function notifyDocumentUploaded(documentId: string): Promise<void> {
  await safely("DOCUMENT_UPLOADED", async () => {
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        type: true,
        passenger: { select: { fullName: true } },
        booking: { select: { id: true, bookingId: true, lead: { select: leadSelect } } },
      },
    });
    if (!document?.booking) return;
    const { booking } = document;
    await notifyStaff({
      type: "DOCUMENT_UPLOADED",
      title: `Document uploaded — ${document.type}`,
      body: `${document.passenger?.fullName ?? "Customer"} · booking ${booking.bookingId} — ready for verification`,
      link: `/crm/bookings/${booking.id}`,
      entityType: "Document",
      entityId: document.id,
      recipients: {
        userIds: booking.lead.assignedStaffId ? [booking.lead.assignedStaffId] : [],
        permission: "documents.view",
        serviceType: booking.lead.serviceType,
      },
    });
  });
}

/**
 * DOCUMENT_REJECTED — staff set a document to REJECTED. Goes to the lead's
 * assigned staff (falling back to documents.view for the service when the
 * lead is unassigned); skipped when the assigned staff member is the one
 * who just rejected it — they don't need to be told about their own action.
 */
export async function notifyDocumentRejected(documentId: string, actorUserId: string): Promise<void> {
  await safely("DOCUMENT_REJECTED", async () => {
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        type: true,
        rejectionReason: true,
        passenger: { select: { fullName: true } },
        booking: { select: { id: true, bookingId: true, lead: { select: leadSelect } } },
      },
    });
    if (!document?.booking) return;
    const { booking } = document;
    if (booking.lead.assignedStaffId === actorUserId) return;
    await notifyStaff({
      type: "DOCUMENT_REJECTED",
      title: `Document rejected — ${document.type}`,
      body: `${document.passenger?.fullName ?? "Customer"} · booking ${booking.bookingId}${document.rejectionReason ? ` — ${document.rejectionReason}` : ""}`,
      link: `/crm/bookings/${booking.id}`,
      entityType: "Document",
      entityId: document.id,
      recipients: leadOwnerOrPermission(booking.lead, "documents.view"),
    });
  });
}

/** REFUND_RAISED — a PENDING refund now needs a refunds.approve user. */
export async function notifyRefundsRaised(refundIds: string[]): Promise<void> {
  for (const refundId of refundIds) {
    // Client testing 2026-10-09 (E4) — the customer is told too.
    await notifyCustomerRefund(refundId, "raised");
    await safely("REFUND_RAISED", async () => {
      const refund = await db.refund.findUnique({
        where: { id: refundId },
        select: {
          id: true,
          refundAmount: true,
          reason: true,
          payment: { select: { booking: { select: { id: true, bookingId: true, lead: { select: leadSelect } } } } },
        },
      });
      if (!refund) return;
      const { booking } = refund.payment;
      await notifyStaff({
        type: "REFUND_RAISED",
        title: `Refund raised — ${formatCurrency(Number(refund.refundAmount), "INR")}`,
        body: `Booking ${booking.bookingId} — awaiting approval${refund.reason ? ` · ${refund.reason}` : ""}`,
        link: `/crm/bookings/${booking.id}`,
        entityType: "Refund",
        entityId: refund.id,
        recipients: { permission: "refunds.approve", serviceType: booking.lead.serviceType },
      });
    });
  }
}
