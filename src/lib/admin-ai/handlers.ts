import { db } from "@/lib/db";
import { getStaffWorkloads } from "@/lib/staff/workload";
import { getIntegrationsHealth } from "@/lib/admin/integrations-health";
import { parseLeadReference, formatLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS, LEAD_STATUS_LABELS } from "@/lib/crm/labels";
import type { ServiceType, BookingStatus } from "@/generated/prisma/enums";
import type { CommandTypeKey } from "./command-types";

const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];
const CONFIG_ENTITY_TYPES = [
  "TaxFeeConfig",
  "CouponConfig",
  "Coupon",
  "PricingRule",
  "DocumentRequirement",
  "Airport",
  "Airline",
  "Border",
  "Vendor",
  "Faq",
  "NotificationTemplate",
  "ServiceStatus",
  "ServiceStatusTransition",
  "ProtectionPlanConfig",
];

export interface HandlerResult {
  summary: string;
  facts: unknown;
  /** Set instead of a real result when the extracted/missing param can't be resolved to anything — a validation failure, not a system error. */
  validationError?: string;
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function matchServiceType(raw: string): ServiceType | null {
  const normalized = raw.trim().toLowerCase();
  for (const [value, label] of Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]) {
    const normalizedValue = value.toLowerCase().replace(/_/g, " ");
    const normalizedLabel = label.toLowerCase();
    if (normalizedValue === normalized || normalizedLabel === normalized || normalizedLabel.includes(normalized) || normalized.includes(normalizedLabel)) {
      return value;
    }
  }
  return null;
}

async function pendingRefunds(): Promise<HandlerResult> {
  const refunds = await db.refund.findMany({
    where: { status: "PENDING" },
    include: { payment: { include: { booking: { include: { customer: true, lead: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  return {
    summary:
      refunds.length === 0
        ? "No refunds are currently pending approval."
        : `${refunds.length} refund(s) pending approval, oldest first.`,
    facts: refunds.map((refund) => ({
      refundId: refund.id,
      bookingId: refund.payment.booking.bookingId,
      customer: refund.payment.booking.customer.name,
      service: SERVICE_TYPE_LABELS[refund.payment.booking.lead.serviceType],
      refundAmount: refund.refundAmount.toString(),
      createdAt: refund.createdAt.toISOString(),
    })),
  };
}

async function failedAutomationsToday(): Promise<HandlerResult> {
  const runs = await db.automationRun.findMany({
    where: { status: "FAILURE", createdAt: { gte: todayUtcMidnight() } },
    orderBy: { createdAt: "desc" },
  });

  return {
    summary: runs.length === 0 ? "No automation jobs have failed today." : `${runs.length} automation job run(s) failed today.`,
    facts: runs.map((run) => ({ workflowKey: run.workflowKey, errorMessage: run.errorMessage, at: run.createdAt.toISOString() })),
  };
}

async function integrationHealth(): Promise<HandlerResult> {
  const integrations = await getIntegrationsHealth();
  const notConfigured = integrations.filter((integration) => !integration.configured).map((integration) => integration.label);
  const withErrors = integrations.filter((integration) => integration.lastError).map((integration) => integration.label);

  const parts: string[] = [];
  if (notConfigured.length > 0) parts.push(`Running on mock/not configured: ${notConfigured.join(", ")}.`);
  if (withErrors.length > 0) parts.push(`Have a recorded error: ${withErrors.join(", ")}.`);
  if (parts.length === 0) parts.push("All four integrations are configured with no recorded errors.");

  return { summary: parts.join(" "), facts: integrations };
}

async function staffWorkload(): Promise<HandlerResult> {
  const staff = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const workloads = await getStaffWorkloads(staff.map((member) => member.id));
  const rows = staff
    .map((member) => ({ name: member.name, ...workloads.get(member.id)! }))
    .sort((a, b) => a.paxCount - b.paxCount);

  return {
    summary:
      rows.length === 0
        ? "No active staff members."
        : `${rows.length} active staff member(s). Least loaded: ${rows[0].name} (${rows[0].paxCount} PAX). Most loaded: ${rows[rows.length - 1].name} (${rows[rows.length - 1].paxCount} PAX).`,
    facts: rows,
  };
}

async function bookingDiagnosis(param: string | null): Promise<HandlerResult> {
  if (!param) {
    return { summary: "", facts: null, validationError: "Which booking? Include a booking id or lead reference in the question." };
  }

  const booking = await db.booking.findFirst({
    where: { bookingId: { contains: param, mode: "insensitive" } },
    include: {
      lead: true,
      customer: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      documents: true,
    },
  });

  if (!booking) {
    const parsedRef = parseLeadReference(param);
    if (parsedRef) {
      const lead = await db.lead.findFirst({
        where: { serviceType: parsedRef.serviceType, id: { endsWith: parsedRef.suffix } },
        include: { customer: true },
      });
      if (lead) {
        const leadBooking = await db.booking.findFirst({
          where: { leadId: lead.id },
          include: { lead: true, customer: true, payments: { orderBy: { createdAt: "desc" }, take: 1 }, documents: true },
          orderBy: { createdAt: "desc" },
        });
        if (!leadBooking) {
          const recentAudit = await db.auditTrail.findMany({
            where: { entityType: "Lead", entityId: lead.id },
            orderBy: { timestamp: "desc" },
            take: 3,
          });
          return {
            summary: `${formatLeadReference(lead.serviceType, lead.id)} (${lead.customer.name}) is still a Lead — status ${LEAD_STATUS_LABELS[lead.status]}, no booking created yet.`,
            facts: {
              leadReference: formatLeadReference(lead.serviceType, lead.id),
              leadStatus: lead.status,
              customer: lead.customer.name,
              recentActivity: recentAudit.map((entry) => ({ action: entry.action, at: entry.timestamp.toISOString(), note: entry.note })),
            },
          };
        }
        return summarizeBooking(leadBooking);
      }
    }
    return { summary: "", facts: null, validationError: `Couldn't find a booking or lead matching "${param}".` };
  }

  return summarizeBooking(booking);
}

async function summarizeBooking(booking: {
  id: string;
  bookingId: string;
  status: BookingStatus;
  createdAt: Date;
  leadId: string;
  lead: { serviceType: ServiceType };
  customer: { name: string };
  payments: { status: string }[];
  documents: { status: string }[];
}): Promise<HandlerResult> {
  const latestPayment = booking.payments[0] ?? null;
  const missingDocuments = booking.documents.filter((document) => document.status === "MISSING");
  const recentAudit = await db.auditTrail.findMany({
    where: { entityType: "Booking", entityId: booking.id },
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  const ageDays = Math.floor((Date.now() - booking.createdAt.getTime()) / (24 * 60 * 60 * 1000));

  const diagnosisPoints: string[] = [];
  if (!latestPayment) diagnosisPoints.push("No payment has been created for this booking yet.");
  else if (latestPayment.status === "PENDING") diagnosisPoints.push("The latest payment is still PENDING — likely waiting on the customer to complete it.");
  else if (latestPayment.status === "FAILED") diagnosisPoints.push("The latest payment attempt FAILED.");
  if (missingDocuments.length > 0) diagnosisPoints.push(`${missingDocuments.length} document(s) are flagged MISSING.`);
  if (diagnosisPoints.length === 0) diagnosisPoints.push("No blocking issues found in the data — this booking appears to be progressing normally.");

  return {
    summary: `${booking.bookingId} (${booking.customer.name}, ${SERVICE_TYPE_LABELS[booking.lead.serviceType]}) — status ${booking.status}, created ${ageDays} day(s) ago. ${diagnosisPoints.join(" ")}`,
    facts: {
      bookingId: booking.bookingId,
      leadReference: formatLeadReference(booking.lead.serviceType, booking.leadId),
      customer: booking.customer.name,
      status: booking.status,
      ageDays,
      latestPaymentStatus: latestPayment?.status ?? "NO_PAYMENT_CREATED",
      missingDocumentCount: missingDocuments.length,
      recentActivity: recentAudit.map((entry) => ({ action: entry.action, at: entry.timestamp.toISOString(), note: entry.note })),
    },
  };
}

async function customerBookings(param: string | null): Promise<HandlerResult> {
  if (!param) {
    return { summary: "", facts: null, validationError: "Which customer? Include a name or mobile number in the question." };
  }

  const customers = await db.customer.findMany({
    where: { OR: [{ name: { contains: param, mode: "insensitive" } }, { mobile: { contains: param, mode: "insensitive" } }] },
    take: 3,
  });
  if (customers.length === 0) {
    return { summary: "", facts: null, validationError: `Couldn't find a customer matching "${param}".` };
  }

  const bookings = await db.booking.findMany({
    where: { customerId: { in: customers.map((customer) => customer.id) } },
    include: { lead: true, customer: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    summary:
      bookings.length === 0
        ? `${customers[0].name} has no bookings yet.`
        : `${customers.length === 1 ? customers[0].name : `${customers.length} matching customers`} — ${bookings.length} booking(s) found.`,
    facts: {
      matchedCustomers: customers.map((customer) => ({ id: customer.id, name: customer.name, mobile: customer.mobile })),
      bookings: bookings.map((booking) => ({
        bookingId: booking.bookingId,
        status: booking.status,
        service: SERVICE_TYPE_LABELS[booking.lead.serviceType],
        customer: booking.customer.name,
        createdAt: booking.createdAt.toISOString(),
      })),
    },
  };
}

async function pocBookings(param: string | null): Promise<HandlerResult> {
  if (!param) {
    return { summary: "", facts: null, validationError: "Which staff member? Include their name in the question." };
  }

  const staffMembers = await db.user.findMany({ where: { name: { contains: param, mode: "insensitive" }, active: true }, take: 3 });
  if (staffMembers.length === 0) {
    return { summary: "", facts: null, validationError: `Couldn't find an active staff member matching "${param}".` };
  }

  const bookings = await db.booking.findMany({
    where: { lead: { assignedStaffId: { in: staffMembers.map((member) => member.id) } }, status: { notIn: TERMINAL_BOOKING_STATUSES } },
    include: { lead: true, customer: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    summary:
      bookings.length === 0
        ? `${staffMembers[0].name} currently has no open bookings.`
        : `${staffMembers.length === 1 ? staffMembers[0].name : `${staffMembers.length} matching staff`} — ${bookings.length} open booking(s).`,
    facts: {
      matchedStaff: staffMembers.map((member) => ({ id: member.id, name: member.name })),
      openBookings: bookings.map((booking) => ({
        bookingId: booking.bookingId,
        status: booking.status,
        service: SERVICE_TYPE_LABELS[booking.lead.serviceType],
        customer: booking.customer.name,
      })),
    },
  };
}

async function todayPaymentsSummary(): Promise<HandlerResult> {
  const payments = await db.payment.findMany({
    where: { status: "SUCCESS", updatedAt: { gte: todayUtcMidnight() } },
    include: { booking: { include: { lead: { include: { quotations: { where: { isSelected: true } } } } } } },
  });

  const totalCollected = payments.reduce(
    (sum, payment) => sum + (Number(payment.amount) - Number(payment.couponDiscount ?? 0) + Number(payment.gstAmount) + Number(payment.gatewayFee)),
    0
  );
  const totalMargin = payments.reduce((sum, payment) => {
    const quotation = payment.booking.lead.quotations[0];
    return sum + (quotation ? Number(quotation.margin) : 0);
  }, 0);

  return {
    summary: `Today: ${payments.length} successful payment(s) totaling ₹${totalCollected.toFixed(2)}, with ₹${totalMargin.toFixed(2)} in margin on those bookings. This is a payments/margin summary, not a full P&L — operating costs aren't tracked in this platform. Payment.updatedAt is used as an approximation of "succeeded today," since there's no dedicated succeeded-at timestamp.`,
    facts: { count: payments.length, totalCollected: totalCollected.toFixed(2), totalMargin: totalMargin.toFixed(2) },
  };
}

async function todayConfigChanges(): Promise<HandlerResult> {
  const changes = await db.auditTrail.findMany({
    where: { entityType: { in: CONFIG_ENTITY_TYPES }, action: { in: ["CREATE", "UPDATE"] }, timestamp: { gte: todayUtcMidnight() } },
    orderBy: { timestamp: "desc" },
    take: 20,
  });

  return {
    summary: changes.length === 0 ? "No pricing/config changes recorded today." : `${changes.length} pricing/config change(s) recorded today.`,
    facts: changes.map((change) => ({ entityType: change.entityType, action: change.action, note: change.note, at: change.timestamp.toISOString() })),
  };
}

async function serviceFunnel(param: string | null): Promise<HandlerResult> {
  if (!param) {
    return { summary: "", facts: null, validationError: "Which service? Name one (e.g. New Visa, OTB, Flight Special Fare)." };
  }

  const serviceType = matchServiceType(param);
  if (!serviceType) {
    return { summary: "", facts: null, validationError: `Couldn't determine which service "${param}" refers to.` };
  }

  const leads = await db.lead.findMany({ where: { serviceType }, select: { status: true } });
  const quotations = await db.quotation.findMany({ where: { lead: { serviceType } }, select: { isSelected: true, isExpired: true } });

  const leadsByStatus: Record<string, number> = {};
  for (const lead of leads) leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;

  const leadsNeverQuoted = (leadsByStatus.NEW ?? 0) + (leadsByStatus.CONTACTED ?? 0) + (leadsByStatus.QUALIFIED ?? 0);
  const quotedNotConverted = leadsByStatus.QUOTED ?? 0;
  const quotesExpiredUnselected = quotations.filter((quotation) => quotation.isExpired && !quotation.isSelected).length;
  const quotesSelected = quotations.filter((quotation) => quotation.isSelected).length;

  const dropOffPoints = [
    { label: "leads that never reached a quotation", count: leadsNeverQuoted },
    { label: "quoted leads that haven't converted", count: quotedNotConverted },
    { label: "quotations that expired without being selected", count: quotesExpiredUnselected },
  ].sort((a, b) => b.count - a.count);
  const biggest = dropOffPoints[0];

  return {
    summary:
      leads.length === 0
        ? `No leads recorded yet for ${SERVICE_TYPE_LABELS[serviceType]}.`
        : `${SERVICE_TYPE_LABELS[serviceType]}: ${leads.length} total leads, ${quotesSelected} quotation(s) selected. Biggest observed drop-off: ${biggest.label} (${biggest.count}).`,
    facts: { serviceType, totalLeads: leads.length, leadsByStatus, quotesSelected, quotesExpiredUnselected, quotedNotConverted },
  };
}

function notAvailable(): HandlerResult {
  return {
    summary:
      "That isn't available in this version. This includes: website/visitor analytics, Meta/Google ad tracking, TAT/SLA records, automated vendor-recommendation reasoning (every vendor choice here is staff-entered manually), and any action that would create, change, or disable something — mutating commands aren't wired up yet, only read-only queries.",
    facts: null,
  };
}

const HANDLERS: Record<CommandTypeKey, (param: string | null) => Promise<HandlerResult>> = {
  PENDING_REFUNDS: pendingRefunds,
  FAILED_AUTOMATIONS_TODAY: failedAutomationsToday,
  INTEGRATION_HEALTH: integrationHealth,
  STAFF_WORKLOAD: staffWorkload,
  BOOKING_DIAGNOSIS: bookingDiagnosis,
  CUSTOMER_BOOKINGS: customerBookings,
  POC_BOOKINGS: pocBookings,
  TODAY_PAYMENTS_SUMMARY: todayPaymentsSummary,
  TODAY_CONFIG_CHANGES: todayConfigChanges,
  SERVICE_FUNNEL: serviceFunnel,
  NOT_AVAILABLE: async () => notAvailable(),
};

/**
 * Step 27 (audit §4.4) — the "Execute" stage of ADMIN.md §10's execution
 * model. Every function above is hand-written, bounded, read-only code —
 * the AI only ever picks a key from this fixed dispatch table, it never
 * generates or runs its own queries.
 */
export async function executeCommand(commandType: CommandTypeKey, param: string | null): Promise<HandlerResult> {
  return HANDLERS[commandType](param);
}
