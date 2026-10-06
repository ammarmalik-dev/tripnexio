import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { hasPermission } from "@/lib/auth/permissions";
import type { StaffSession } from "@/lib/auth/staff-session";
import { buildAdminOverview } from "@/lib/admin/overview";
import { getBookingTimeline } from "@/lib/audit/booking-timeline";
import { getAuditTimeline } from "@/lib/audit/timeline";
import { REPORTS } from "@/lib/reports/registry";
import { leadReference, parseLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS, LEAD_STATUS_LABELS } from "@/lib/crm/labels";
import type { LeadStatus, LeadTemperature, ServiceType } from "@/generated/prisma/enums";
import type { HandlerResult } from "./handlers";

/**
 * Client corrections 2026-10-05 — "Admin can ask for any permitted available
 * data, logs, reports, booking logs and system logs." Still a closed set of
 * hand-written READ handlers (the AI only picks one and extracts a param),
 * each checking the permission its own screen needs.
 */

export interface CommandContext {
  question: string;
  session: StaffSession;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_LIMIT = 25;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Reads a period from free text: today, yesterday, this/last week, this/last month, last N days. Default: last 30 days. */
export function parsePeriod(text: string, now = new Date()): { from: Date; to: Date; label: string } {
  const t = text.toLowerCase();
  const today = startOfUtcDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  if (/\byesterday\b|\bkal\b/.test(t)) return { from: new Date(today.getTime() - DAY_MS), to: today, label: "yesterday" };
  if (/\btoday\b|\baaj\b/.test(t)) return { from: today, to: tomorrow, label: "today" };
  const lastN = t.match(/(?:last|past|pichl[ae])\s+(\d{1,3})\s*(day|days|din|week|weeks|month|months)/);
  if (lastN) {
    const n = Number(lastN[1]);
    const days = lastN[2].startsWith("week") ? n * 7 : lastN[2].startsWith("month") ? n * 30 : n;
    return { from: new Date(tomorrow.getTime() - days * DAY_MS), to: tomorrow, label: `last ${days} days` };
  }
  const weekStart = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  if (/last week|previous week|pichl[ae] hafte/.test(t)) return { from: new Date(weekStart.getTime() - 7 * DAY_MS), to: weekStart, label: "last week" };
  if (/this week|is hafte/.test(t)) return { from: weekStart, to: tomorrow, label: "this week" };
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (/last month|previous month|pichl[ae] mahine/.test(t)) {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: monthStart, label: "last month" };
  }
  if (/this month|is mahine/.test(t)) return { from: monthStart, to: tomorrow, label: "this month" };
  return { from: new Date(tomorrow.getTime() - 30 * DAY_MS), to: tomorrow, label: "last 30 days" };
}

function denied(what: string): HandlerResult {
  return { summary: "", facts: null, validationError: `You don't have permission to view ${what}.` };
}

export async function periodSummary(param: string | null, ctx: CommandContext): Promise<HandlerResult> {
  const period = parsePeriod(`${param ?? ""} ${ctx.question}`);
  const includeFinance = hasPermission(ctx.session, "finance.manage");
  const overview = await buildAdminOverview({ from: period.from, to: period.to, includeFinance });
  const parts = [`${overview.leads.total} lead(s)`, `${overview.bookings.total} paid booking(s)`];
  if (overview.finance) {
    parts.push(`revenue ₹${overview.finance.revenue.toFixed(2)}`, `gross profit ₹${overview.finance.grossProfit.toFixed(2)}`, `refunds ₹${overview.finance.refunds.toFixed(2)}`);
  }
  return {
    summary: `${period.label[0].toUpperCase()}${period.label.slice(1)}: ${parts.join(", ")}.${includeFinance ? "" : " Revenue/profit figures need the finance permission."}`,
    facts: { period: period.label, leads: overview.leads, bookings: overview.bookings, finance: overview.finance },
  };
}

async function findLeadByReference(reference: string) {
  const parsed = parseLeadReference(reference);
  return db.lead.findFirst({
    where: {
      OR: [
        { reference: { equals: reference.trim(), mode: "insensitive" } },
        ...(parsed ? [{ serviceType: parsed.serviceType, id: { endsWith: parsed.suffix } }] : []),
      ],
    },
    select: { id: true, reference: true, serviceType: true, createdAt: true },
  });
}

export async function bookingLog(param: string | null, ctx: CommandContext): Promise<HandlerResult> {
  if (!hasPermission(ctx.session, "bookings.view")) return denied("booking logs");
  if (!param) return { summary: "", facts: null, validationError: "Which booking or lead? Include its ID in the question." };

  const booking = await db.booking.findFirst({
    where: { bookingId: { equals: param.trim(), mode: "insensitive" } },
    select: { id: true, bookingId: true, leadId: true, payments: { select: { id: true, refunds: { select: { id: true } } } }, documents: { select: { id: true } } },
  });
  let timeline;
  let label: string;
  if (booking) {
    timeline = await getBookingTimeline(booking, ROW_LIMIT);
    label = booking.bookingId;
  } else {
    const lead = await findLeadByReference(param);
    if (!lead) return { summary: "", facts: null, validationError: `Couldn't find a booking or lead matching "${param}".` };
    timeline = await getAuditTimeline([{ entityType: "Lead", entityId: lead.id }], ROW_LIMIT);
    label = leadReference(lead);
  }
  return {
    summary: `${label}: ${timeline.entries.length} log entr${timeline.entries.length === 1 ? "y" : "ies"}${timeline.truncated ? " (most recent shown)" : ""}.`,
    facts: timeline.entries.map((entry) => ({
      at: entry.timestamp.toISOString(),
      record: entry.entityType,
      action: entry.action,
      by: entry.byUser?.name ?? "System",
      note: entry.note,
    })),
  };
}

export async function auditLog(param: string | null, ctx: CommandContext): Promise<HandlerResult> {
  if (!hasPermission(ctx.session, "staff.manage")) return denied("the audit log");
  const period = parsePeriod(`${param ?? ""} ${ctx.question}`);
  const staffName = param?.trim();
  const user = staffName ? await db.user.findFirst({ where: { name: { contains: staffName, mode: "insensitive" } }, select: { id: true, name: true } }) : null;
  const rows = await db.auditTrail.findMany({
    where: { timestamp: { gte: period.from, lt: period.to }, ...(user ? { byUserId: user.id } : {}) },
    orderBy: { timestamp: "desc" },
    take: ROW_LIMIT,
    select: { timestamp: true, entityType: true, action: true, note: true, byUser: { select: { name: true } } },
  });
  return {
    summary: `${rows.length} most recent audit entr${rows.length === 1 ? "y" : "ies"} (${period.label}${user ? `, by ${user.name}` : ""}).`,
    facts: rows.map((row) => ({ at: row.timestamp.toISOString(), record: row.entityType, action: row.action, by: row.byUser?.name ?? "System", note: row.note })),
  };
}

const SYSTEM_FAILURE_ACTIONS = ["EMAIL_FAILED", "WHATSAPP_FAILED", "OCR_FAILED", "PAYMENT_AMOUNT_MISMATCH", "PAYMENT_GATEWAY_ERROR"];

export async function systemLogs(param: string | null, ctx: CommandContext): Promise<HandlerResult> {
  if (!hasPermission(ctx.session, "automation.view")) return denied("system logs");
  const period = parsePeriod(`${param ?? ""} ${ctx.question}`);
  const [failures, runs] = await runSequentially([
    () =>
      db.auditTrail.findMany({
        where: { action: { in: SYSTEM_FAILURE_ACTIONS }, timestamp: { gte: period.from, lt: period.to } },
        orderBy: { timestamp: "desc" },
        take: ROW_LIMIT,
        select: { timestamp: true, action: true, entityType: true, note: true },
      }),
    () =>
      db.automationRun.findMany({
        where: { status: "FAILURE", createdAt: { gte: period.from, lt: period.to } },
        orderBy: { createdAt: "desc" },
        take: ROW_LIMIT,
        select: { createdAt: true, workflowKey: true, errorMessage: true },
      }),
  ]);
  return {
    summary: `${period.label[0].toUpperCase()}${period.label.slice(1)}: ${failures.length} integration failure(s) (email/WhatsApp/OCR/payment) and ${runs.length} failed automation run(s).`,
    facts: {
      integrationFailures: failures.map((row) => ({ at: row.timestamp.toISOString(), type: row.action, record: row.entityType, note: row.note })),
      automationFailures: runs.map((run) => ({ at: run.createdAt.toISOString(), job: run.workflowKey, error: run.errorMessage })),
    },
  };
}

export async function runReport(param: string | null, ctx: CommandContext): Promise<HandlerResult> {
  if (!hasPermission(ctx.session, "finance.manage")) return denied("finance and MIS reports");
  const wanted = (param ?? "").trim().toLowerCase();
  const report =
    REPORTS.find((candidate) => candidate.key === wanted) ??
    REPORTS.find((candidate) => candidate.title.toLowerCase() === wanted) ??
    REPORTS.find((candidate) => wanted && (candidate.title.toLowerCase().includes(wanted) || wanted.includes(candidate.key.replace(/-/g, " "))));
  if (!report) {
    return { summary: "", facts: null, validationError: `Which report? Available: ${REPORTS.map((candidate) => candidate.title).join(", ")}.` };
  }
  const period = parsePeriod(ctx.question);
  const result = await report.run({ from: period.from, to: period.to });
  return {
    summary: `${report.title} (${period.label}): ${result.rows.length} row(s)${result.rows.length > ROW_LIMIT ? `, first ${ROW_LIMIT} shown — open Admin → Finance & MIS Reports for the full report` : ""}.`,
    facts: { report: report.key, columns: result.columns.map((column) => column.label), rows: result.rows.slice(0, ROW_LIMIT), totals: result.totals ?? null, notes: result.notes ?? [] },
  };
}

const TEMPERATURES: Record<string, LeadTemperature> = { hot: "HOT", warm: "WARM", cold: "COLD" };

export async function leadList(param: string | null, ctx: CommandContext): Promise<HandlerResult> {
  if (!hasPermission(ctx.session, "leads.view")) return denied("leads");
  const text = `${param ?? ""} ${ctx.question}`.toLowerCase();
  const period = parsePeriod(text);
  const serviceType = (Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).find(([, label]) => text.includes(label.toLowerCase()))?.[0];
  const temperature = Object.entries(TEMPERATURES).find(([word]) => new RegExp(`\\b${word}\\b`).test(text))?.[1];
  const status = (Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]).find(([, label]) => text.includes(label.toLowerCase()))?.[0];
  const unassigned = /unassigned|no poc|without poc/.test(text);

  const where = {
    createdAt: { gte: period.from, lt: period.to },
    ...(serviceType ? { serviceType } : {}),
    ...(temperature ? { temperature } : {}),
    ...(status ? { status } : {}),
    ...(unassigned ? { assignedStaffId: null } : {}),
  };
  const [total, leads] = await runSequentially([
    () => db.lead.count({ where }),
    () =>
      db.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: ROW_LIMIT,
        select: {
          id: true,
          reference: true,
          serviceType: true,
          createdAt: true,
          status: true,
          temperature: true,
          source: true,
          customer: { select: { name: true } },
          assignedStaff: { select: { name: true } },
        },
      }),
  ]);
  const filters = [period.label, serviceType && SERVICE_TYPE_LABELS[serviceType], temperature?.toLowerCase(), status && LEAD_STATUS_LABELS[status], unassigned && "unassigned"]
    .filter(Boolean)
    .join(", ");
  return {
    summary: `${total} lead(s) (${filters})${total > ROW_LIMIT ? `, newest ${ROW_LIMIT} shown` : ""}.`,
    facts: leads.map((lead) => ({
      lead: leadReference(lead),
      customer: lead.customer.name,
      service: SERVICE_TYPE_LABELS[lead.serviceType],
      status: LEAD_STATUS_LABELS[lead.status],
      temperature: lead.temperature,
      source: lead.source,
      poc: lead.assignedStaff?.name ?? "Unassigned",
      created: lead.createdAt.toISOString(),
    })),
  };
}
