import { db } from "../db";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { SERVICE_TYPE_LABELS, BOOKING_STATUS_LABELS } from "./labels";
import type { BookingStatus, ServiceType } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";

/**
 * P21 item 9 — CRM.md §30 Delay Analysis. The single source of truth for
 * "is this booking delayed?", used by both /crm/delays and the Command
 * Centre's "Delayed"/"Staff Action Required" KPIs.
 *
 * Delay definition (both SLAs come from Admin → Timelines / SLA, i.e.
 * ServiceTimelineConfig via getServiceTimelineRules — nothing is hardcoded):
 *
 * 1. Completion SLA — a booking is delayed once `expectedCompletionHours`
 *    have passed since the booking was created and it still isn't
 *    COMPLETED/CANCELLED/REFUNDED (OPEN). A COMPLETED booking whose
 *    completion came after the deadline counts as RESOLVED. There is no
 *    `completedAt` column, so the completion moment is approximated by the
 *    booking's `updatedAt` (the last write, normally the completing status
 *    change). Cancelled/refunded bookings are excluded entirely.
 * 2. Document verification SLA — a booking document still RECEIVED
 *    (uploaded, awaiting staff verification) more than
 *    `documentVerificationHours` after its upload. Upload time is
 *    approximated by the document's `updatedAt` (the upload is the write
 *    that moves it to RECEIVED). Only OPEN delays are reported for this
 *    type — once verified, the original upload time is no longer
 *    recoverable from the row, so resolved document delays aren't counted.
 *    Passenger-only documents (no booking) are skipped: there's no booking
 *    to open and no service to look an SLA up for.
 *
 * A service with neither hour value configured (or an inactive config) is
 * excluded and reported in `unconfiguredServices`.
 *
 * Delay duration = time past the deadline (until resolution, or until now
 * while still open), not time since the booking started.
 *
 * Queries stay modest (flat selects, capped with `take`) — the local dev
 * Postgres drops connections under heavy nested includes.
 */

export const DELAY_TYPES = ["COMPLETION_SLA", "DOCUMENT_VERIFICATION_SLA"] as const;
export type DelayType = (typeof DELAY_TYPES)[number];

export const DELAY_TYPE_LABELS: Record<DelayType, string> = {
  COMPLETION_SLA: "Completion SLA",
  DOCUMENT_VERIFICATION_SLA: "Document verification SLA",
};

/** Per-query row cap — keeps a very large backlog from turning into one enormous query. */
const DELAY_QUERY_CAP = 2000;
const HOUR_MS = 60 * 60 * 1000;
const OPEN_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "PROCESSING"];

/** CRM.md §30's "Category" — the stage the booking is stuck at, derived from its status. */
const STATUS_CATEGORY: Record<BookingStatus, string> = {
  PENDING: "Awaiting processing",
  CONFIRMED: "Confirmed, not yet processing",
  PROCESSING: "External processing (vendor/embassy/airline)",
  COMPLETED: "Completed late",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export interface DelayRecord {
  key: string;
  type: DelayType;
  reason: string;
  category: string;
  status: "OPEN" | "RESOLVED";
  bookingId: string;
  bookingReference: string;
  bookingStatus: BookingStatus;
  bookingStatusLabel: string;
  serviceType: ServiceType;
  serviceLabel: string;
  customerName: string;
  /** Lead.details.travelDate when the service captures one (CRM.md §30 "Service Date"). */
  serviceDate: string | null;
  /** When the SLA clock started (booking creation, or document upload). */
  startedAt: string;
  /** When the SLA ran out. */
  dueAt: string;
  resolvedAt: string | null;
  /** Hours past the deadline (until resolution, or until now while open). One decimal. */
  delayHours: number;
  staffId: string | null;
  staffName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  documentType: string | null;
}

export interface DelayBreakdownRow {
  key: string;
  label: string;
  total: number;
  open: number;
  resolved: number;
  averageDelayHours: number | null;
}

export interface ServiceSlaInfo {
  serviceType: ServiceType;
  serviceLabel: string;
  expectedCompletionHours: number | null;
  documentVerificationHours: number | null;
}

export interface DelayAnalysis {
  generatedAt: string;
  totals: {
    total: number;
    open: number;
    resolved: number;
    /** Distinct bookings with at least one open delay. */
    openBookings: number;
    averageDelayHours: number | null;
    longestOpenHours: number | null;
  };
  byService: DelayBreakdownRow[];
  byStaff: DelayBreakdownRow[];
  byVendor: DelayBreakdownRow[];
  byReason: DelayBreakdownRow[];
  byCategory: DelayBreakdownRow[];
  /** Newest-deadline-first; open delays before resolved ones. */
  records: DelayRecord[];
  configuredServices: ServiceSlaInfo[];
  unconfiguredServices: { serviceType: ServiceType; serviceLabel: string }[];
  /** True when a query hit DELAY_QUERY_CAP — the figures then cover only the most recent rows. */
  truncated: boolean;
}

type ServiceScope = ServiceType[] | undefined;

interface SlaMap {
  completion: Map<ServiceType, number>;
  documents: Map<ServiceType, number>;
  configured: ServiceSlaInfo[];
  unconfigured: { serviceType: ServiceType; serviceLabel: string }[];
}

const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[];

async function loadSlas(scope: ServiceScope): Promise<SlaMap> {
  const services = scope ? ALL_SERVICE_TYPES.filter((serviceType) => scope.includes(serviceType)) : ALL_SERVICE_TYPES;
  const completion = new Map<ServiceType, number>();
  const documents = new Map<ServiceType, number>();
  const configured: ServiceSlaInfo[] = [];
  const unconfigured: { serviceType: ServiceType; serviceLabel: string }[] = [];

  // Sequential on purpose — tiny single-row lookups, and this environment's
  // pooled local Postgres dislikes bursts of concurrent queries.
  for (const serviceType of services) {
    const rules = await getServiceTimelineRules(serviceType);
    const completionHours = rules.expectedCompletionHours && rules.expectedCompletionHours > 0 ? rules.expectedCompletionHours : null;
    const documentHours = rules.documentVerificationHours && rules.documentVerificationHours > 0 ? rules.documentVerificationHours : null;
    if (completionHours === null && documentHours === null) {
      unconfigured.push({ serviceType, serviceLabel: SERVICE_TYPE_LABELS[serviceType] });
      continue;
    }
    if (completionHours !== null) completion.set(serviceType, completionHours);
    if (documentHours !== null) documents.set(serviceType, documentHours);
    configured.push({
      serviceType,
      serviceLabel: SERVICE_TYPE_LABELS[serviceType],
      expectedCompletionHours: completionHours,
      documentVerificationHours: documentHours,
    });
  }
  return { completion, documents, configured, unconfigured };
}

const bookingSelect = {
  id: true,
  bookingId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  leadId: true,
  customer: { select: { name: true } },
  lead: { select: { serviceType: true, details: true, assignedStaff: { select: { id: true, name: true } } } },
} as const satisfies Prisma.BookingSelect;

interface BookingRow {
  id: string;
  bookingId: string;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
  leadId: string;
  customer: { name: string };
  lead: { serviceType: ServiceType; details: unknown; assignedStaff: { id: string; name: string } | null };
}

function travelDateOf(details: unknown): string | null {
  if (details && typeof details === "object" && "travelDate" in details) {
    const value = (details as { travelDate?: unknown }).travelDate;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  return null;
}

function roundHours(ms: number): number {
  return Math.round((ms / HOUR_MS) * 10) / 10;
}

/** One `{serviceType, cutoff}` per configured service — the SLA clock must have started before `cutoff` to be past due now. */
function slaCutoffs(slaByService: Map<ServiceType, number>, now: Date) {
  return [...slaByService.entries()].map(([serviceType, hours]) => ({
    serviceType,
    cutoff: new Date(now.getTime() - hours * HOUR_MS),
  }));
}

interface CollectOptions {
  includeResolved: boolean;
}

async function collectDelays(scope: ServiceScope, options: CollectOptions): Promise<{ records: DelayRecord[]; slas: SlaMap; truncated: boolean }> {
  const now = new Date();
  const slas = await loadSlas(scope);
  const records: DelayRecord[] = [];
  let truncated = false;

  // --- 1. Completion SLA --------------------------------------------------
  const completionCutoffs = slaCutoffs(slas.completion, now);
  let bookings: BookingRow[] = [];
  if (completionCutoffs.length > 0) {
    const statuses: BookingStatus[] = options.includeResolved ? [...OPEN_BOOKING_STATUSES, "COMPLETED"] : OPEN_BOOKING_STATUSES;
    bookings = await db.booking.findMany({
      where: {
        status: { in: statuses },
        OR: completionCutoffs.map(({ serviceType, cutoff }) => ({ lead: { serviceType }, createdAt: { lt: cutoff } })),
      },
      select: bookingSelect,
      orderBy: { createdAt: "desc" },
      take: DELAY_QUERY_CAP + 1,
    });
    if (bookings.length > DELAY_QUERY_CAP) {
      truncated = true;
      bookings = bookings.slice(0, DELAY_QUERY_CAP);
    }
  }

  // --- 2. Document verification SLA ---------------------------------------
  const documentCutoffs = slaCutoffs(slas.documents, now);
  let documents: { id: string; type: string; updatedAt: Date; booking: BookingRow | null }[] = [];
  if (documentCutoffs.length > 0) {
    documents = await db.document.findMany({
      where: {
        status: "RECEIVED",
        bookingId: { not: null },
        OR: documentCutoffs.map(({ serviceType, cutoff }) => ({ booking: { lead: { serviceType } }, updatedAt: { lt: cutoff } })),
      },
      select: { id: true, type: true, updatedAt: true, booking: { select: bookingSelect } },
      orderBy: { updatedAt: "desc" },
      take: DELAY_QUERY_CAP + 1,
    });
    if (documents.length > DELAY_QUERY_CAP) {
      truncated = true;
      documents = documents.slice(0, DELAY_QUERY_CAP);
    }
  }

  // --- Vendor lookup: one flat query for the selected quotations ---------
  const leadIds = new Set<string>();
  for (const booking of bookings) leadIds.add(booking.leadId);
  for (const document of documents) if (document.booking) leadIds.add(document.booking.leadId);
  const vendorByLead = new Map<string, { id: string; name: string }>();
  if (leadIds.size > 0) {
    const selected = await db.quotation.findMany({
      where: { leadId: { in: [...leadIds] }, isSelected: true },
      select: { leadId: true, vendor: { select: { id: true, name: true } } },
    });
    for (const quotation of selected) vendorByLead.set(quotation.leadId, quotation.vendor);
  }

  function baseFields(booking: BookingRow) {
    const vendor = vendorByLead.get(booking.leadId) ?? null;
    return {
      bookingId: booking.id,
      bookingReference: booking.bookingId,
      bookingStatus: booking.status,
      bookingStatusLabel: BOOKING_STATUS_LABELS[booking.status],
      serviceType: booking.lead.serviceType,
      serviceLabel: SERVICE_TYPE_LABELS[booking.lead.serviceType],
      customerName: booking.customer.name,
      serviceDate: travelDateOf(booking.lead.details),
      staffId: booking.lead.assignedStaff?.id ?? null,
      staffName: booking.lead.assignedStaff?.name ?? null,
      vendorId: vendor?.id ?? null,
      vendorName: vendor?.name ?? null,
    };
  }

  for (const booking of bookings) {
    const hours = slas.completion.get(booking.lead.serviceType);
    if (hours === undefined) continue;
    const dueAt = new Date(booking.createdAt.getTime() + hours * HOUR_MS);
    const isCompleted = booking.status === "COMPLETED";
    // A completed booking only counts if it was completed after its deadline.
    if (isCompleted && booking.updatedAt <= dueAt) continue;
    const endAt = isCompleted ? booking.updatedAt : now;
    records.push({
      key: `COMPLETION_SLA:${booking.id}`,
      type: "COMPLETION_SLA",
      reason: DELAY_TYPE_LABELS.COMPLETION_SLA,
      category: STATUS_CATEGORY[booking.status],
      status: isCompleted ? "RESOLVED" : "OPEN",
      startedAt: booking.createdAt.toISOString(),
      dueAt: dueAt.toISOString(),
      resolvedAt: isCompleted ? booking.updatedAt.toISOString() : null,
      delayHours: roundHours(endAt.getTime() - dueAt.getTime()),
      documentType: null,
      ...baseFields(booking),
    });
  }

  for (const document of documents) {
    const booking = document.booking;
    if (!booking) continue;
    const hours = slas.documents.get(booking.lead.serviceType);
    if (hours === undefined) continue;
    // A cancelled/refunded booking's unverified document isn't an operational delay any more.
    if (booking.status === "CANCELLED" || booking.status === "REFUNDED") continue;
    const dueAt = new Date(document.updatedAt.getTime() + hours * HOUR_MS);
    records.push({
      key: `DOCUMENT_VERIFICATION_SLA:${document.id}`,
      type: "DOCUMENT_VERIFICATION_SLA",
      reason: DELAY_TYPE_LABELS.DOCUMENT_VERIFICATION_SLA,
      category: "Document awaiting verification",
      status: "OPEN",
      startedAt: document.updatedAt.toISOString(),
      dueAt: dueAt.toISOString(),
      resolvedAt: null,
      delayHours: roundHours(now.getTime() - dueAt.getTime()),
      documentType: document.type,
      ...baseFields(booking),
    });
  }

  return { records, slas, truncated };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function breakdown(records: DelayRecord[], keyOf: (record: DelayRecord) => { key: string; label: string }): DelayBreakdownRow[] {
  const groups = new Map<string, { label: string; items: DelayRecord[] }>();
  for (const record of records) {
    const { key, label } = keyOf(record);
    const group = groups.get(key) ?? { label, items: [] };
    group.items.push(record);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      total: group.items.length,
      open: group.items.filter((item) => item.status === "OPEN").length,
      resolved: group.items.filter((item) => item.status === "RESOLVED").length,
      averageDelayHours: average(group.items.map((item) => item.delayHours)),
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total || a.label.localeCompare(b.label));
}

/** Full analysis for the /crm/delays page. `scope` = the staff member's allowed services (undefined = unrestricted). */
export async function getDelayAnalysis(scope?: ServiceScope): Promise<DelayAnalysis> {
  const { records, slas, truncated } = await collectDelays(scope, { includeResolved: true });

  const open = records.filter((record) => record.status === "OPEN");
  const openHours = open.map((record) => record.delayHours);

  const sorted = [...records].sort((a, b) => {
    if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
    return b.delayHours - a.delayHours;
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      total: records.length,
      open: open.length,
      resolved: records.length - open.length,
      openBookings: new Set(open.map((record) => record.bookingId)).size,
      averageDelayHours: average(records.map((record) => record.delayHours)),
      longestOpenHours: openHours.length > 0 ? Math.max(...openHours) : null,
    },
    byService: breakdown(records, (record) => ({ key: record.serviceType, label: record.serviceLabel })),
    byStaff: breakdown(records, (record) => ({ key: record.staffId ?? "unassigned", label: record.staffName ?? "Unassigned" })),
    byVendor: breakdown(records, (record) => ({ key: record.vendorId ?? "none", label: record.vendorName ?? "No vendor selected" })),
    byReason: breakdown(records, (record) => ({ key: record.type, label: record.reason })),
    byCategory: breakdown(records, (record) => ({ key: record.category, label: record.category })),
    records: sorted,
    configuredServices: slas.configured,
    unconfiguredServices: slas.unconfigured,
    truncated,
  };
}

export interface DelayKpis {
  /** Distinct bookings with at least one open delay — the Command Centre "Delayed" KPI. */
  delayedBookings: number;
  /**
   * Distinct bookings with an open Completion-SLA delay whose status isn't
   * PENDING. Added to "Staff Action Required" — PENDING bookings and
   * RECEIVED documents (the document-SLA case) are already counted there,
   * so only this remainder is new, never double-counted.
   */
  completionDelayedBeyondPending: number;
}

/** Open delays only — the lighter query set the Command Centre needs. */
export async function getDelayKpis(scope?: ServiceScope): Promise<DelayKpis> {
  const { records } = await collectDelays(scope, { includeResolved: false });
  const open = records.filter((record) => record.status === "OPEN");
  return {
    delayedBookings: new Set(open.map((record) => record.bookingId)).size,
    completionDelayedBeyondPending: new Set(
      open.filter((record) => record.type === "COMPLETION_SLA" && record.bookingStatus !== "PENDING").map((record) => record.bookingId)
    ).size,
  };
}

/**
 * P22 — every open delay across all services (unscoped), for the
 * staff-alerts automation's DELAY notifications. Same single source of
 * truth as the /crm/delays page and the Command Centre KPIs.
 */
export async function getOpenDelayRecords(): Promise<DelayRecord[]> {
  const { records } = await collectDelays(undefined, { includeResolved: false });
  return records.filter((record) => record.status === "OPEN");
}
