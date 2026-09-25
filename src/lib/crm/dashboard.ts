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
  /** Every lead created in the period, regardless of status — the funnel/temperature-donut baseline. */
  totalLeads: number;
  /**
   * Raw per-`LeadStatus` counts for leads created in the period — reused by
   * `buildConversionFunnel()` below so the Command Centre's funnel chart
   * needs zero extra DB round trips (this groupBy already runs for the KPI
   * cards above).
   */
  leadsByStatus: Record<string, number>;
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
  | "LEAD_STALLED"
  // Step 53 (Internal Dashboard Merged §3) — 3 new "Most Action Required" buckets.
  | "PAYMENT_PENDING"
  | "APPROACHING_TRAVEL_DATE"
  | "UNASSIGNED_INACTIVE_STAFF";

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
//
// Step 49 — every non-terminal, non-CONVERTED status (i.e. everything
// except CONVERTED/LOST/CLOSED). Widened slightly from the old list's
// intent (NEW/CONTACTED/QUALIFIED/QUOTED) to also include
// QUOTATION_ACCEPTED/PAYMENT_PENDING — a lead that accepted a quote but
// hasn't paid in 3+ days is just as good a candidate for a follow-up nudge
// as one still waiting on a quote.
const LEAD_STALLED_STATUSES = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP_REQUIRED",
  "CUSTOMER_RESPONDED",
  "QUALIFIED",
  "QUOTATION_CREATED",
  "QUOTATION_ACCEPTED",
  "PAYMENT_PENDING",
] as const;
const LEAD_STALLED_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const ACTION_QUEUE_GROUP_LIMIT = 8;

/**
 * Step 53 — "approaching travel dates" is only meaningful for the 4
 * services whose Lead.details actually carries a `travelDate` string
 * (New Visa/OTB/Return Ticket/Flight Special Fare — confirmed by reading
 * each service's own lead-intake route). Visa Extension/Visa Change have
 * no future-travel-date concept at all (their dates are visa-expiry/
 * entry-exit, a different meaning), so they're never included here — not
 * an oversight, there's genuinely nothing to check. 7 days is a judgment
 * call (no client-specified threshold), matching the same "give it a
 * number, disclose it" precedent as LEAD_STALLED_AFTER_MS above.
 */
const TRAVEL_DATE_SERVICES = ["NEW_VISA", "OTB", "RETURN_TICKET", "FLIGHT_SPECIAL_FARE"] as const;
const APPROACHING_TRAVEL_DATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** A Lead this far along has either converted or died — no travel date on it is still "approaching" in a way that needs action. */
const TRAVEL_DATE_TERMINAL_STATUSES = ["CONVERTED", "LOST", "CLOSED"] as const;

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

  const leadsByStatus: Record<string, number> = {};
  for (const g of leadGroups) {
    leadsByStatus[g.status] = (leadsByStatus[g.status] ?? 0) + g._count._all;
  }

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
    totalLeads: totalLeadsInPeriod,
    leadsByStatus,
  };
}

export interface DashboardTrendPoint {
  label: string;
  value: number;
}

export interface ServiceBreakdownItem {
  serviceType: ServiceType;
  count: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** 0-100, relative to the first (New) stage. */
  percentOfFirst: number;
}

/**
 * The 7-stage "primary path" funnel (New -> Converted) the Command Centre
 * charts. Built as a pure function over `SalesOverview.leadsByStatus`
 * (already fetched, no new query) rather than a separate DB call.
 *
 * This schema has no per-stage timestamp history (only the current
 * `status` + `updatedAt`), so — same honesty standard as
 * LEAD_STALLED_STATUSES/TRAVEL_DATE_WINDOW above — each stage's count is a
 * disclosed approximation: "leads currently at or past this stage",
 * computed by summing every status whose pipeline position is >= the
 * stage's own position. `FOLLOW_UP_REQUIRED`/`CUSTOMER_RESPONDED` fold into
 * the "Contacted" tier (they're side-states at the same pipeline depth,
 * not a distinct later stage). `LOST`/`CLOSED` are deliberately excluded —
 * they exited the pipeline, so counting them "at" some earlier stage would
 * overstate that stage's real in-flight/converted volume.
 */
const FUNNEL_STAGES: { key: string; label: string; statuses: string[] }[] = [
  { key: "NEW", label: "New", statuses: ["NEW", "CONTACTED", "FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"] },
  { key: "CONTACTED", label: "Contacted", statuses: ["CONTACTED", "FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"] },
  { key: "QUALIFIED", label: "Qualified", statuses: ["QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"] },
  { key: "QUOTATION_CREATED", label: "Quotation Created", statuses: ["QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"] },
  { key: "QUOTATION_ACCEPTED", label: "Quotation Accepted", statuses: ["QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"] },
  { key: "PAYMENT_PENDING", label: "Payment Pending", statuses: ["PAYMENT_PENDING", "CONVERTED"] },
  { key: "CONVERTED", label: "Converted", statuses: ["CONVERTED"] },
];

export function buildConversionFunnel(leadsByStatus: Record<string, number>): FunnelStage[] {
  const firstStageCount = FUNNEL_STAGES[0].statuses.reduce((sum, s) => sum + (leadsByStatus[s] ?? 0), 0);
  return FUNNEL_STAGES.map((stage) => {
    const count = stage.statuses.reduce((sum, s) => sum + (leadsByStatus[s] ?? 0), 0);
    return {
      key: stage.key,
      label: stage.label,
      count,
      percentOfFirst: firstStageCount === 0 ? 0 : Math.round((count / firstStageCount) * 1000) / 10,
    };
  });
}

/** Leads created in the period, grouped by `ServiceType` — one extra indexed groupBy, feeds the "Leads by Service" chart. */
export async function getLeadsByServiceBreakdown(period: DashboardPeriod, allowedServiceTypes?: ServiceScope): Promise<ServiceBreakdownItem[]> {
  const leadScope = allowedServiceTypes ? { serviceType: { in: allowedServiceTypes } } : {};
  const groups = await db.lead.groupBy({
    by: ["serviceType"],
    where: { createdAt: { gte: period.startDate, lte: period.endDate }, ...leadScope },
    _count: { _all: true },
  });
  return groups
    .map((g) => ({ serviceType: g.serviceType, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

const TREND_DAY_MS = 24 * 60 * 60 * 1000;
/** Above this many days, `getLeadsTrend` buckets by week instead of by day, so the chart never has to plot 90+ points. */
const TREND_DAILY_MAX_SPAN_DAYS = 31;

function bucketByDay(timestamps: Date[], start: Date, end: Date): DashboardTrendPoint[] {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / TREND_DAY_MS));
  const buckets = new Array<number>(days + 1).fill(0);
  for (const t of timestamps) {
    const dayIndex = Math.floor((t.getTime() - start.getTime()) / TREND_DAY_MS);
    if (dayIndex >= 0 && dayIndex <= days) buckets[dayIndex] += 1;
  }
  return buckets.map((value, i) => {
    const date = new Date(start.getTime() + i * TREND_DAY_MS);
    return { label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value };
  });
}

function bucketByWeek(timestamps: Date[], start: Date, end: Date): DashboardTrendPoint[] {
  const weekMs = 7 * TREND_DAY_MS;
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / weekMs));
  const buckets = new Array<number>(weeks).fill(0);
  for (const t of timestamps) {
    const weekIndex = Math.floor((t.getTime() - start.getTime()) / weekMs);
    if (weekIndex >= 0 && weekIndex < weeks) buckets[weekIndex] += 1;
  }
  return buckets.map((value, i) => {
    const weekStart = new Date(start.getTime() + i * weekMs);
    return { label: weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value };
  });
}

/**
 * New leads per day (or per week for a long period) across the selected
 * date range — a single-column `select` (not the whole row), bucketed in
 * JS same as `getActionQueue`'s travel-date filtering already does, since
 * Postgres date-truncation isn't expressible through Prisma's `groupBy`.
 */
export async function getLeadsTrend(period: DashboardPeriod, allowedServiceTypes?: ServiceScope): Promise<DashboardTrendPoint[]> {
  const leadScope = allowedServiceTypes ? { serviceType: { in: allowedServiceTypes } } : {};
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: period.startDate, lte: period.endDate }, ...leadScope },
    select: { createdAt: true },
  });
  const timestamps = leads.map((l) => l.createdAt);
  const spanDays = (period.endDate.getTime() - period.startDate.getTime()) / TREND_DAY_MS;
  return spanDays <= TREND_DAILY_MAX_SPAN_DAYS
    ? bucketByDay(timestamps, period.startDate, period.endDate)
    : bucketByWeek(timestamps, period.startDate, period.endDate);
}

const REVENUE_TREND_WEEKS = 8;

/**
 * Successful-payment revenue for the last 8 weeks, always — deliberately
 * NOT scoped to the Command Centre's period filter, same "live operational
 * trend, not a period-created count" reasoning `getOperationsOverview`'s
 * own doc comment already gives for staying unscoped.
 */
export async function getRevenueTrend(allowedServiceTypes?: ServiceScope): Promise<DashboardTrendPoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - REVENUE_TREND_WEEKS * 7 * TREND_DAY_MS);
  const payments = await db.payment.findMany({
    where: {
      status: "SUCCESS",
      createdAt: { gte: start, lte: end },
      ...(allowedServiceTypes ? { booking: { lead: { serviceType: { in: allowedServiceTypes } } } } : {}),
    },
    select: { amount: true, createdAt: true },
  });

  const weekMs = 7 * TREND_DAY_MS;
  const buckets = new Array<number>(REVENUE_TREND_WEEKS).fill(0);
  for (const p of payments) {
    const weekIndex = Math.floor((p.createdAt.getTime() - start.getTime()) / weekMs);
    // Payment.amount is a Prisma Decimal, not a plain number — must convert before accumulating.
    if (weekIndex >= 0 && weekIndex < REVENUE_TREND_WEEKS) buckets[weekIndex] += Number(p.amount);
  }
  return buckets.map((value, i) => {
    const weekStart = new Date(start.getTime() + i * weekMs);
    return { label: weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value };
  });
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
  // Step 53 — "pending payments" as its own queue item, distinct from the
  // Sales Overview KPI count above (which is period-scoped by createdAt;
  // this is a live snapshot, same distinction Operations Overview already draws).
  const pendingPayments = await db.payment.findMany({
    where: { status: "PENDING", ...bookingLeadScope },
    orderBy: { createdAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { booking: { include: { customer: true } } },
  });
  // Step 53 — "approaching travel dates." travelDate lives in Lead.details
  // (JSON, not a real column), so this can't be pushed into the where
  // clause the way every other item type above is — narrowed by
  // serviceType/status first, then travelDate parsed and range-checked in
  // JS. Only the 4 services that actually have a travelDate concept are
  // queried at all (see TRAVEL_DATE_SERVICES' own doc comment).
  const travelDateCandidates = await db.lead.findMany({
    where: { serviceType: { in: [...TRAVEL_DATE_SERVICES] }, status: { notIn: [...TRAVEL_DATE_TERMINAL_STATUSES] }, ...leadScope },
    select: { id: true, serviceType: true, details: true, customer: { select: { name: true } } },
  });
  // Step 53 — "unassigned work caused by inactive employees" (Step 50's
  // own "effectively unassigned" concept, surfaced here as an action item
  // rather than just a display label).
  const assignedToInactiveStaff = await db.lead.findMany({
    where: {
      assignedStaffId: { not: null },
      assignedStaff: { active: false },
      status: { notIn: [...TRAVEL_DATE_TERMINAL_STATUSES] },
      ...leadScope,
    },
    orderBy: { updatedAt: "asc" },
    take: ACTION_QUEUE_GROUP_LIMIT,
    include: { customer: true, assignedStaff: true },
  });

  const travelDateWindowEnd = new Date(now.getTime() + APPROACHING_TRAVEL_DATE_WINDOW_MS);
  const approachingTravelDates: ActionQueueItem[] = travelDateCandidates
    .map((lead) => {
      const details = (lead.details ?? {}) as Record<string, unknown>;
      const travelDateRaw = typeof details.travelDate === "string" ? details.travelDate : null;
      if (!travelDateRaw) return null;
      const travelDate = new Date(travelDateRaw);
      if (Number.isNaN(travelDate.getTime()) || travelDate < now || travelDate > travelDateWindowEnd) return null;
      const item: ActionQueueItem = {
        type: "APPROACHING_TRAVEL_DATE",
        label: "Travel date approaching",
        detail: `${lead.customer.name} — ${formatLeadReference(lead.serviceType, lead.id)}`,
        href: `/crm/leads/${lead.id}`,
        occurredAt: travelDate.toISOString(),
      };
      return item;
    })
    .filter((item): item is ActionQueueItem => item !== null)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .slice(0, ACTION_QUEUE_GROUP_LIMIT);

  const expiringSoon: ActionQueueItem[] = [
    ...expiringQuotes.map((q): ActionQueueItem => ({
      type: "QUOTE_EXPIRING",
      label: "Quote expiring soon",
      detail: `${q.lead.customer.name} — ${formatLeadReference(q.lead.serviceType, q.leadId)}`,
      href: `/crm/leads/${q.leadId}`,
      occurredAt: (q.validityExpiresAt as Date).toISOString(),
    })),
    ...approachingTravelDates,
  ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const needsAttention: ActionQueueItem[] = [];

  for (const p of pendingPayments) {
    if (!p.booking) continue;
    needsAttention.push({
      type: "PAYMENT_PENDING",
      label: "Payment pending — follow up",
      detail: `${p.booking.customer.name} — ${p.booking.bookingId}`,
      href: `/crm/bookings/${p.booking.id}`,
      occurredAt: p.createdAt.toISOString(),
    });
  }
  for (const lead of assignedToInactiveStaff) {
    needsAttention.push({
      type: "UNASSIGNED_INACTIVE_STAFF",
      label: "Unassigned — assignee no longer active",
      detail: `${lead.customer.name} — ${formatLeadReference(lead.serviceType, lead.id)} (was: ${lead.assignedStaff!.name})`,
      href: `/crm/leads/${lead.id}`,
      occurredAt: lead.updatedAt.toISOString(),
    });
  }

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

  // Step 53 — 8 backlog types now feed this one flat, globally-sorted
  // list (was 6 before PAYMENT_PENDING/UNASSIGNED_INACTIVE_STAFF), each
  // already capped at ACTION_QUEUE_GROUP_LIMIT of its own oldest items —
  // but the FINAL slice below still only keeps the oldest N across all of
  // them combined, so a type with enough older competing items could
  // otherwise get crowded out of the display entirely even though its own
  // query correctly found real candidates (caught directly by this step's
  // own verification — see the roadmap notes). Widened from *2 to *3 to
  // give every type a more realistic chance of appearing, not a full fix
  // for cross-type fairness (a true per-type minimum would need a bigger
  // restructure) — flagged, not silently left as a growing blind spot.
  return { expiringSoon, needsAttention: needsAttention.slice(0, ACTION_QUEUE_GROUP_LIMIT * 3) };
}
