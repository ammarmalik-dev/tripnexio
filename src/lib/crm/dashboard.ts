import { db } from "../db";
import { formatLeadReference } from "../leads/reference";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Step 39: `undefined` (the normal case, an unrestricted session) means no
 * filter at all — every function below stays byte-for-byte the same query
 * it always was. A scoped staff member's dashboard only aggregates their
 * allowed services' numbers, so a scoped view never leaks out-of-scope
 * volume/KPI figures — the whole point of scoping would otherwise be
 * undermined by the one screen every staff member sees on login.
 */
type ServiceScope = ServiceType[] | undefined;

export interface DashboardPeriod {
  startDate: Date;
  endDate: Date;
}

/**
 * CRM.md §4 lists "Hot/Warm/Cold Leads" as a possible KPI — real as of Step
 * 12 (the `Lead.temperature` field). "Delayed" is still `null`: there's no
 * Delay/DelayAnalysis model at all yet (a later, unscoped feature — CRM.md
 * §30 has its own "Delay Analysis" nav item). Per CLAUDE.md hard rule #1
 * ("never invent authoritative domain data... don't fabricate numbers"),
 * an unbuildable KPI stays `null` -> the UI's "Coming soon" state, rather
 * than a fake 0 or being silently dropped.
 */
export interface SalesOverview {
  newLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  quotationsCreated: number;
  acceptedQuotations: number;
  /** Percentage, 0-100, one decimal place. */
  conversionRate: number;
  paymentPending: number;
  paymentReceived: number;
}

export interface OperationsOverview {
  activeBookings: number;
  documentsPending: number;
  customerActionRequired: number;
  staffActionRequired: number;
  externalProcessing: number;
  delayed: null;
  refundsRaised: number;
  completed: number;
}

export type ActionQueueItemType =
  | "QUOTE_EXPIRING"
  | "QUOTATION_ACCEPTED_NEEDS_BOOKING"
  | "NEW_BOOKING"
  | "DOCUMENT_MISSING"
  | "DOCUMENT_RECEIVED"
  | "DOCUMENT_REJECTED"
  | "REFUND_PENDING"
  | "LEAD_STALLED";

export interface ActionQueueItem {
  type: ActionQueueItemType;
  label: string;
  detail: string;
  href: string;
  /** ISO timestamp — a future deadline for QUOTE_EXPIRING, a past "waiting since" moment for everything else. */
  occurredAt: string;
}

// Same status list + threshold as the n8n "Periodic Service Follow-ups"
// automation job (src/app/api/automation/lead-followup/route.ts) — reused
// rather than re-invented so "stalled" means the same thing everywhere in
// the app.
const LEAD_STALLED_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED"] as const;
const LEAD_STALLED_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const ACTION_QUEUE_GROUP_LIMIT = 8;

/**
 * This machine's local `prisma dev` Postgres has a connection_limit of 10
 * (see the DATABASE_URL it prints) and this environment is already prone to
 * ConnectionClosed errors under load (feedback_prisma_dev_connection_closed
 * in memory) — Prisma's `groupBy` collapses what would otherwise be several
 * separate `count()` round-trips (one per status value) into one query per
 * model, keeping this page's peak concurrent connection usage well under
 * that limit instead of firing a dozen-plus queries at once.
 */
export async function getSalesOverview(period: DashboardPeriod, allowedServiceTypes?: ServiceScope): Promise<SalesOverview> {
  const createdInPeriod = { createdAt: { gte: period.startDate, lte: period.endDate } };
  const leadScope = allowedServiceTypes ? { serviceType: { in: allowedServiceTypes } } : {};
  const leadRelationScope = allowedServiceTypes ? { lead: { serviceType: { in: allowedServiceTypes } } } : {};

  const [leadGroups, quotationsCreated, acceptedQuotations, paymentStatusGroups] = await Promise.all([
    // Grouping by both status and temperature in one query (rather than two
    // separate groupBy calls) — same connection-pool-pressure reasoning as
    // the rest of this file.
    db.lead.groupBy({ by: ["status", "temperature"], where: { ...createdInPeriod, ...leadScope }, _count: { _all: true } }),
    db.quotation.count({ where: { ...createdInPeriod, ...leadRelationScope } }),
    // Approximation: Quotation has no separate "acceptedAt" timestamp, so
    // this counts quotations created in the period that are currently
    // selected — not necessarily selected within the period itself.
    db.quotation.count({ where: { ...createdInPeriod, isSelected: true, ...leadRelationScope } }),
    db.payment.groupBy({
      by: ["status"],
      where: { ...createdInPeriod, ...(allowedServiceTypes ? { booking: { lead: { serviceType: { in: allowedServiceTypes } } } } : {}) },
      _count: { _all: true },
    }),
  ]);

  const leadCountByStatus = (status: string) =>
    leadGroups.filter((g) => g.status === status).reduce((sum, g) => sum + g._count._all, 0);
  const leadCountByTemperature = (temperature: string) =>
    leadGroups.filter((g) => g.temperature === temperature).reduce((sum, g) => sum + g._count._all, 0);
  const totalLeadsInPeriod = leadGroups.reduce((sum, g) => sum + g._count._all, 0);
  const paymentCount = (status: string) => paymentStatusGroups.find((g) => g.status === status)?._count._all ?? 0;
  const convertedLeadsInPeriod = leadCountByStatus("CONVERTED");

  return {
    newLeads: leadCountByStatus("NEW"),
    qualifiedLeads: leadCountByStatus("QUALIFIED"),
    hotLeads: leadCountByTemperature("HOT"),
    warmLeads: leadCountByTemperature("WARM"),
    coldLeads: leadCountByTemperature("COLD"),
    quotationsCreated,
    acceptedQuotations,
    conversionRate: totalLeadsInPeriod === 0 ? 0 : Math.round((convertedLeadsInPeriod / totalLeadsInPeriod) * 1000) / 10,
    paymentPending: paymentCount("PENDING"),
    paymentReceived: paymentCount("SUCCESS"),
  };
}

/**
 * Deliberately NOT period-scoped, unlike Sales Overview — this answers
 * CRM.md §4's "what needs action now", a live operational snapshot, not a
 * count of things created in a date range.
 */
export async function getOperationsOverview(allowedServiceTypes?: ServiceScope): Promise<OperationsOverview> {
  const bookingLeadScope = allowedServiceTypes ? { lead: { serviceType: { in: allowedServiceTypes } } } : {};
  const [bookingStatusGroups, documentStatusGroups, refundsRaised] = await Promise.all([
    db.booking.groupBy({ by: ["status"], where: bookingLeadScope, _count: { _all: true } }),
    // A passenger-only document (no booking) has no derivable serviceType —
    // same reasoning as the review queue (src/app/api/documents/route.ts)
    // — so it's simply excluded from a scoped count rather than guessed at.
    db.document.groupBy({
      by: ["status"],
      where: allowedServiceTypes ? { booking: { lead: { serviceType: { in: allowedServiceTypes } } } } : {},
      _count: { _all: true },
    }),
    db.refund.count({
      where: { status: "PENDING", ...(allowedServiceTypes ? { payment: { booking: { lead: { serviceType: { in: allowedServiceTypes } } } } } : {}) },
    }),
  ]);

  const bookingCount = (status: string) => bookingStatusGroups.find((g) => g.status === status)?._count._all ?? 0;
  const documentCount = (status: string) => documentStatusGroups.find((g) => g.status === status)?._count._all ?? 0;

  return {
    activeBookings: bookingCount("PENDING") + bookingCount("CONFIRMED") + bookingCount("PROCESSING"),
    documentsPending: documentCount("REQUIRED") + documentCount("MISSING"),
    // Customer must act: a flagged-missing document needs a re-upload.
    customerActionRequired: documentCount("MISSING"),
    // Staff must act: a customer-uploaded document awaiting validation, or
    // a booking that hasn't been picked up for processing yet.
    staffActionRequired: documentCount("RECEIVED") + bookingCount("PENDING"),
    // Sent to an external party (vendor/airline/embassy) — the existing
    // BookingStatus.PROCESSING state.
    externalProcessing: bookingCount("PROCESSING"),
    delayed: null,
    refundsRaised,
    completed: bookingCount("COMPLETED"),
  };
}

export interface ActionQueueGroups {
  /** Time-critical, minutes-to-hours horizon — sorted soonest-deadline-first. */
  expiringSoon: ActionQueueItem[];
  /** Backlog items — sorted longest-waiting-first (oldest updatedAt/createdAt). */
  needsAttention: ActionQueueItem[];
}

/**
 * CRM.md §4's "Most Action Required" queue. Only built from signals that
 * genuinely exist in the schema today (Quotation validity, Document status,
 * Refund status, Booking status, stalled Leads) — the spec's own example
 * list also mentions "Ticket ready", "Visa approved", and "OTB action
 * required", none of which have a distinct status field anywhere yet (that
 * workflow isn't built), so none of those three are invented here.
 *
 * Document-related items are scoped to `bookingId != null` — a
 * passenger-only document (no booking yet, e.g. from passport-OCR upload at
 * lead intake) has nowhere to link to yet, since /crm/customers is still a
 * placeholder screen.
 */
export async function getActionQueue(allowedServiceTypes?: ServiceScope): Promise<ActionQueueGroups> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - LEAD_STALLED_AFTER_MS);
  const leadScope = allowedServiceTypes ? { serviceType: { in: allowedServiceTypes } } : {};
  const leadRelationScope = allowedServiceTypes ? { lead: { serviceType: { in: allowedServiceTypes } } } : {};
  const bookingLeadScope = allowedServiceTypes ? { booking: { lead: { serviceType: { in: allowedServiceTypes } } } } : {};

  // Sequential, not Promise.all — same connection-pool-pressure reasoning as
  // getSalesOverview/getOperationsOverview above, but these 8 queries are
  // findMany()+include (not collapsible via groupBy), so the fix here is
  // simply not firing them all at once rather than restructuring the query
  // shape.
  const expiringQuotes = await db.quotation.findMany({
    where: { isExpired: false, isSelected: false, validityExpiresAt: { gt: now }, ...leadRelationScope },
    orderBy: { validityExpiresAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { lead: { include: { customer: true } } },
  });
  const documentsMissing = await db.document.findMany({
    where: { status: "MISSING", bookingId: { not: null }, ...bookingLeadScope },
    orderBy: { updatedAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { booking: { include: { customer: true } } },
  });
  const documentsReceived = await db.document.findMany({
    where: { status: "RECEIVED", bookingId: { not: null }, ...bookingLeadScope },
    orderBy: { updatedAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { booking: { include: { customer: true } } },
  });
  const documentsRejected = await db.document.findMany({
    where: { status: "REJECTED", bookingId: { not: null }, ...bookingLeadScope },
    orderBy: { updatedAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { booking: { include: { customer: true } } },
  });
  const pendingRefunds = await db.refund.findMany({
    where: { status: "PENDING", ...(allowedServiceTypes ? { payment: bookingLeadScope } : {}) },
    orderBy: { createdAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { payment: { include: { booking: { include: { customer: true } } } } },
  });
  const newBookings = await db.booking.findMany({
    where: { status: "PENDING", ...leadRelationScope },
    orderBy: { createdAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { customer: true },
  });
  const staleLeads = await db.lead.findMany({
    where: { status: { in: [...LEAD_STALLED_STATUSES] }, updatedAt: { lt: staleCutoff }, ...leadScope },
    orderBy: { updatedAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { customer: true },
  });
  const selectedQuotations = await db.quotation.findMany({
    where: { isSelected: true, ...leadRelationScope },
    include: { lead: { include: { customer: true, bookings: true } } },
  });

  const expiringSoon: ActionQueueItem[] = expiringQuotes.map((q) => ({
    type: "QUOTE_EXPIRING",
    label: "Quote expiring soon",
    detail: `${q.lead.customer.name} — ${formatLeadReference(q.lead.serviceType, q.leadId)}`,
    href: `/crm/leads/${q.leadId}`,
    occurredAt: (q.validityExpiresAt as Date).toISOString(),
  }));

  const needsAttention: ActionQueueItem[] = [];

  for (const d of documentsMissing) {
    if (!d.booking) continue;
    needsAttention.push({
      type: "DOCUMENT_MISSING",
      label: "Document flagged missing",
      detail: `${d.booking.customer.name} — ${d.booking.bookingId}`,
      href: `/crm/bookings/${d.booking.id}`,
      occurredAt: d.updatedAt.toISOString(),
    });
  }
  for (const d of documentsReceived) {
    if (!d.booking) continue;
    needsAttention.push({
      type: "DOCUMENT_RECEIVED",
      label: "Customer documents uploaded — validate",
      detail: `${d.booking.customer.name} — ${d.booking.bookingId}`,
      href: `/crm/bookings/${d.booking.id}`,
      occurredAt: d.updatedAt.toISOString(),
    });
  }
  for (const d of documentsRejected) {
    if (!d.booking) continue;
    needsAttention.push({
      type: "DOCUMENT_REJECTED",
      label: "Document rejected — review",
      detail: `${d.booking.customer.name} — ${d.booking.bookingId}`,
      href: `/crm/bookings/${d.booking.id}`,
      occurredAt: d.updatedAt.toISOString(),
    });
  }
  for (const r of pendingRefunds) {
    if (!r.payment.booking) continue;
    needsAttention.push({
      type: "REFUND_PENDING",
      label: "Refund raised — follow up",
      detail: `${r.payment.booking.customer.name} — ${r.payment.booking.bookingId}`,
      href: `/crm/bookings/${r.payment.booking.id}`,
      occurredAt: r.createdAt.toISOString(),
    });
  }
  for (const b of newBookings) {
    needsAttention.push({
      type: "NEW_BOOKING",
      label: "New booking arrived — process",
      detail: `${b.customer.name} — ${b.bookingId}`,
      href: `/crm/bookings/${b.id}`,
      occurredAt: b.createdAt.toISOString(),
    });
  }
  for (const lead of staleLeads) {
    needsAttention.push({
      type: "LEAD_STALLED",
      label: "Follow-up due — no recent activity",
      detail: `${lead.customer.name} — ${formatLeadReference(lead.serviceType, lead.id)}`,
      href: `/crm/leads/${lead.id}`,
      occurredAt: lead.updatedAt.toISOString(),
    });
  }
  for (const q of selectedQuotations) {
    const hasActiveBooking = q.lead.bookings.some((b) => b.status !== "CANCELLED");
    if (hasActiveBooking) continue;
    needsAttention.push({
      type: "QUOTATION_ACCEPTED_NEEDS_BOOKING",
      label: "Client accepted quotation — create booking",
      detail: `${q.lead.customer.name} — ${formatLeadReference(q.lead.serviceType, q.leadId)}`,
      href: `/crm/leads/${q.leadId}`,
      occurredAt: q.updatedAt.toISOString(),
    });
  }

  needsAttention.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return { expiringSoon, needsAttention: needsAttention.slice(0, ACTION_QUEUE_GROUP_LIMIT * 2) };
}
