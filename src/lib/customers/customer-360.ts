import { db } from "../db";
import { hasPermission } from "../auth/permissions";
import { isServiceScopeUnrestricted, serviceTypeCondition } from "../auth/service-scope";
import type { StaffSession } from "../auth/staff-session";
import { leadReference } from "../leads/reference";
import { isExpiredNow, syncExpiredQuotations } from "../quotations/sync-expiry";
import { toWhatsAppId } from "../whatsapp/phone";
import type { Prisma } from "../../generated/prisma/client";
import type {
  Customer360Communication,
  Customer360Response,
  Customer360TimelineEntry,
} from "./types";

/** Notification-outcome AuditTrail actions — shown under Communications, kept out of the Timeline. */
const COMMUNICATION_AUDIT_ACTIONS = [
  "EMAIL_SENT",
  "EMAIL_SKIPPED",
  "EMAIL_FAILED",
  "WHATSAPP_SENT",
  "WHATSAPP_SKIPPED",
  "WHATSAPP_FAILED",
];

export const CUSTOMER_TIMELINE_CAP = 200;
export const CUSTOMER_COMMUNICATIONS_CAP = 100;

type Customer360Result =
  | { kind: "ok"; data: Customer360Response }
  | { kind: "not_found" }
  | { kind: "forbidden" };

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function refsFor(entityType: string, ids: string[]): Prisma.AuditTrailWhereInput[] {
  return ids.length ? [{ entityType, entityId: { in: ids } }] : [];
}

/**
 * CRM.md §23 — Customer 360. Every section is its own small query, run in
 * dependency waves with Promise.all (one deep nested include has crashed
 * the local dev DB before). Service-scoped staff only see this customer's
 * leads in their allowed services (and the bookings/payments/… hanging off
 * those leads); a scoped staff member with no in-scope lead for this
 * customer gets `forbidden`. Sections whose own view permission the role
 * lacks come back as `null`.
 */
export async function loadCustomer360(session: StaffSession, customerId: string): Promise<Customer360Result> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, mobile: true, email: true, passwordHash: true, createdAt: true, updatedAt: true },
  });
  if (!customer) return { kind: "not_found" };

  const unrestricted = isServiceScopeUnrestricted(session);
  const canSee = {
    bookings: hasPermission(session, "bookings.view"),
    quotations: hasPermission(session, "quotations.view"),
    payments: hasPermission(session, "payments.view"),
    refunds: hasPermission(session, "refunds.view"),
    documents: hasPermission(session, "documents.view"),
    tasks: hasPermission(session, "tasks.view"),
  };

  // Wave 1 — leads (in scope) and passengers.
  const [leads, passengers] = await Promise.all([
    db.lead.findMany({
      where: { customerId, ...serviceTypeCondition(session) },
      select: { id: true, reference: true, serviceType: true, status: true, source: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.passenger.findMany({
      where: { customerId },
      select: {
        id: true,
        fullName: true,
        passportNumber: true,
        nationality: true,
        paxType: true,
        dob: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!unrestricted && leads.length === 0) return { kind: "forbidden" };

  const leadIds = leads.map((lead) => lead.id);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const passengerIds = passengers.map((passenger) => passenger.id);
  const passengerNameById = new Map(passengers.map((passenger) => [passenger.id, passenger.fullName]));

  // Wave 2 — bookings and quotations of those leads.
  const [bookings, rawQuotations] = await Promise.all([
    db.booking.findMany({
      where: { customerId, leadId: { in: leadIds } },
      select: { id: true, bookingId: true, leadId: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    // An empty `in` list / empty OR matches nothing, so a gated-off section just yields [].
    db.quotation.findMany({ where: { leadId: { in: canSee.quotations ? leadIds : [] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const quotations = await syncExpiredQuotations(rawQuotations);

  const bookingIds = bookings.map((booking) => booking.id);
  const bookingDisplayIdById = new Map(bookings.map((booking) => [booking.id, booking.bookingId]));

  // Wave 3 — payments, documents, tasks.
  const taskOr: Prisma.TaskWhereInput[] = [
    ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
    ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
    ...(passengerIds.length ? [{ passengerId: { in: passengerIds } }] : []),
  ];
  const documentOr: Prisma.DocumentWhereInput[] = [
    ...(bookingIds.length ? [{ bookingId: { in: bookingIds } }] : []),
    // Passenger documents not yet tied to a booking (e.g. a passport uploaded at intake).
    ...(passengerIds.length ? [{ passengerId: { in: passengerIds }, bookingId: null }] : []),
  ];

  const [payments, documents, tasks] = await Promise.all([
    db.payment.findMany({
      where: { bookingId: { in: bookingIds } },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        couponDiscount: true,
        gstAmount: true,
        gatewayFee: true,
        status: true,
        method: true,
        purpose: true,
        invoiceNumber: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.document.findMany({
      where: { OR: documentOr },
      select: {
        id: true,
        type: true,
        status: true,
        bookingId: true,
        passengerId: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.task.findMany({
      where: { OR: canSee.tasks ? taskOr : [] },
      select: {
        id: true,
        type: true,
        priority: true,
        status: true,
        title: true,
        reason: true,
        leadId: true,
        bookingId: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const paymentIds = payments.map((payment) => payment.id);
  const paymentBookingById = new Map(payments.map((payment) => [payment.id, payment.bookingId]));
  const documentIds = documents.map((document) => document.id);

  // Wave 4 — refunds.
  const refunds = await db.refund.findMany({
    where: { paymentId: { in: paymentIds } },
    select: { id: true, paymentId: true, refundAmount: true, status: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Wave 5 — AuditTrail (timeline + notification outcomes) and the WhatsApp message log.
  const entityRefs: Prisma.AuditTrailWhereInput[] = [
    { entityType: "Customer", entityId: customer.id },
    ...refsFor("Lead", leadIds),
    ...refsFor("Quotation", quotations.map((quotation) => quotation.id)),
    ...refsFor("Booking", bookingIds),
    ...refsFor("Payment", paymentIds),
    ...refsFor("Refund", refunds.map((refund) => refund.id)),
    ...refsFor("Document", documentIds),
    ...refsFor("Passenger", passengerIds),
  ];

  const [timelineRows, communicationAuditRows, whatsappMessages] = await Promise.all([
    db.auditTrail.findMany({
      where: { OR: entityRefs, action: { notIn: COMMUNICATION_AUDIT_ACTIONS } },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        note: true,
        timestamp: true,
        byUser: { select: { name: true } },
      },
      orderBy: { timestamp: "desc" },
      take: CUSTOMER_TIMELINE_CAP + 1,
    }),
    db.auditTrail.findMany({
      where: { OR: entityRefs, action: { in: COMMUNICATION_AUDIT_ACTIONS } },
      select: { id: true, action: true, note: true, timestamp: true, byUser: { select: { name: true } } },
      orderBy: { timestamp: "desc" },
      take: CUSTOMER_COMMUNICATIONS_CAP + 1,
    }),
    // WhatsAppMessageLog has no customer FK — it's keyed by the WhatsApp number (same as the lead Communications panel).
    db.whatsAppMessageLog.findMany({
      where: { waId: toWhatsAppId(customer.mobile) },
      select: { id: true, direction: true, body: true, createdAt: true, sentByUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: CUSTOMER_COMMUNICATIONS_CAP + 1,
    }),
  ]);

  const allCommunications: Customer360Communication[] = [
    ...communicationAuditRows.map((row) => ({
      id: row.id,
      channel: row.action.startsWith("EMAIL") ? ("EMAIL" as const) : ("WHATSAPP" as const),
      direction: "OUTBOUND" as const,
      status: row.action,
      body: row.note ?? "",
      sentBy: row.byUser?.name ?? null,
      timestamp: row.timestamp.toISOString(),
    })),
    ...whatsappMessages.map((message) => ({
      id: message.id,
      channel: "WHATSAPP" as const,
      direction: message.direction,
      status: null,
      body: message.body,
      sentBy: message.sentByUser?.name ?? null,
      timestamp: message.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const communicationsTruncated =
    allCommunications.length > CUSTOMER_COMMUNICATIONS_CAP ||
    communicationAuditRows.length > CUSTOMER_COMMUNICATIONS_CAP ||
    whatsappMessages.length > CUSTOMER_COMMUNICATIONS_CAP;

  const timeline: Customer360TimelineEntry[] = timelineRows.slice(0, CUSTOMER_TIMELINE_CAP).map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    note: row.note,
    timestamp: row.timestamp.toISOString(),
    byUser: row.byUser ? { name: row.byUser.name } : null,
  }));

  const data: Customer360Response = {
    customer: {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      hasAccount: customer.passwordHash !== null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    },
    leads: leads.map((lead) => ({
      id: lead.id,
      referenceId: leadReference(lead),
      serviceType: lead.serviceType,
      status: lead.status,
      source: lead.source,
      createdAt: lead.createdAt.toISOString(),
    })),
    bookings: canSee.bookings
      ? bookings.map((booking) => ({
          id: booking.id,
          bookingId: booking.bookingId,
          leadId: booking.leadId,
          serviceType: leadById.get(booking.leadId)?.serviceType ?? "OTHER",
          status: booking.status,
          createdAt: booking.createdAt.toISOString(),
        }))
      : null,
    passengers: passengers.map((passenger) => ({
      id: passenger.id,
      fullName: passenger.fullName,
      passportNumber: passenger.passportNumber,
      nationality: passenger.nationality,
      paxType: passenger.paxType,
      dob: iso(passenger.dob),
      createdAt: passenger.createdAt.toISOString(),
    })),
    // Explicit field-by-field mapping: vendorCost, margin, vendorId and vendorReference are never copied.
    quotations: canSee.quotations
      ? quotations.map((quotation) => {
          const lead = leadById.get(quotation.leadId);
          return {
            id: quotation.id,
            leadId: quotation.leadId,
            leadReferenceId: lead ? leadReference(lead) : "",
            serviceType: lead?.serviceType ?? "OTHER",
            sellingPrice: quotation.sellingPrice.toString(),
            couponDiscount: quotation.couponDiscount?.toString() ?? null,
            airline: quotation.airline,
            route: quotation.route,
            isSelected: quotation.isSelected,
            isExpired: quotation.isExpired || (!quotation.isSelected && isExpiredNow(quotation)),
            validityExpiresAt: iso(quotation.validityExpiresAt),
            createdAt: quotation.createdAt.toISOString(),
          };
        })
      : null,
    payments: canSee.payments
      ? payments.map((payment) => {
          const discount = payment.couponDiscount ? Number(payment.couponDiscount) : 0;
          const total = Number(payment.amount) - discount + Number(payment.gstAmount) + Number(payment.gatewayFee);
          return {
            id: payment.id,
            bookingId: payment.bookingId,
            bookingDisplayId: bookingDisplayIdById.get(payment.bookingId) ?? "",
            amount: payment.amount.toString(),
            couponDiscount: payment.couponDiscount?.toString() ?? null,
            gstAmount: payment.gstAmount.toString(),
            gatewayFee: payment.gatewayFee.toString(),
            total: total.toFixed(2),
            status: payment.status,
            method: payment.method,
            purpose: payment.purpose,
            invoiceNumber: payment.invoiceNumber,
            createdAt: payment.createdAt.toISOString(),
          };
        })
      : null,
    refunds: canSee.refunds
      ? refunds.map((refund) => {
          const bookingId = paymentBookingById.get(refund.paymentId) ?? "";
          return {
            id: refund.id,
            paymentId: refund.paymentId,
            bookingId,
            bookingDisplayId: bookingDisplayIdById.get(bookingId) ?? "",
            refundAmount: refund.refundAmount.toString(),
            status: refund.status,
            reason: refund.reason,
            createdAt: refund.createdAt.toISOString(),
          };
        })
      : null,
    documents: canSee.documents
      ? documents.map((document) => ({
          id: document.id,
          type: document.type,
          status: document.status,
          bookingId: document.bookingId,
          bookingDisplayId: document.bookingId ? (bookingDisplayIdById.get(document.bookingId) ?? null) : null,
          passengerName: document.passengerId ? (passengerNameById.get(document.passengerId) ?? null) : null,
          deliveredAt: iso(document.deliveredAt),
          createdAt: document.createdAt.toISOString(),
        }))
      : null,
    communications: allCommunications.slice(0, CUSTOMER_COMMUNICATIONS_CAP),
    tasks: canSee.tasks
      ? tasks.map((task) => ({
          id: task.id,
          type: task.type,
          priority: task.priority,
          status: task.status,
          title: task.title,
          reason: task.reason,
          leadId: task.leadId,
          bookingId: task.bookingId,
          assignedTo: task.assignedTo?.name ?? null,
          dueDate: iso(task.dueDate),
          completedAt: iso(task.completedAt),
          createdAt: task.createdAt.toISOString(),
        }))
      : null,
    timeline,
    truncated: { communications: communicationsTruncated, timeline: timelineRows.length > CUSTOMER_TIMELINE_CAP },
  };

  return { kind: "ok", data };
}
