import { db } from "../db";
import { getOpenDelayRecords, type DelayRecord } from "../crm/delays";
import { getReport } from "./registry";
import { buildManagementReport } from "./management";
import type { ReportResult } from "./types";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { leadReference } from "../leads/reference";
import { escapeHtml } from "../html/escape";
import type { XlsxCell, XlsxSheet } from "../excel/xlsx";

/** One section of a staff / Admin report: a title, its column headers and its rows (email table + Excel tab). */
export interface ReportSection {
  title: string;
  group: "Sales" | "Operations" | "Finance";
  columns: string[];
  rows: XlsxCell[][];
}

const OPEN_LEAD = { notIn: ["CONVERTED", "LOST", "CLOSED"] as ("CONVERTED" | "LOST" | "CLOSED")[] };
const PENDING_SALES_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING"] as const;
const MAX_ROWS = 2000;

const fmt = (date: Date | null | undefined, offsetMs: number) =>
  date ? new Date(date.getTime() + offsetMs).toISOString().slice(0, 16).replace("T", " ") : "";
const label = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * Client doc 16 Nov (N11) — one POC's action-required items (only their own): new leads since the last alert,
 * follow-ups due, pending sales actions, new bookings, pending tasks, documents to review, delayed bookings and SLA
 * escalations. `userId` null = every staff member's items (Admin reports).
 */
export async function buildActionSections(input: { userId: string | null; since: Date; now: Date; offsetMs: number; delays?: DelayRecord[] }): Promise<ReportSection[]> {
  const { userId, since, now, offsetMs } = input;
  const mine = userId ? { assignedStaffId: userId } : {};
  const [newLeads, followUps, pendingLeads, newBookings, tasks, documents, escalations] = [
    await db.lead.findMany({
      where: { ...mine, status: OPEN_LEAD, createdAt: { gte: since, lte: now } },
      select: { id: true, serviceType: true, reference: true, createdAt: true, status: true, customer: { select: { name: true, mobile: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
    await db.lead.findMany({
      where: { ...mine, status: OPEN_LEAD, nextFollowUpAt: { lte: now } },
      select: { id: true, serviceType: true, reference: true, createdAt: true, nextFollowUpAt: true, followUpNote: true, customer: { select: { name: true } } },
      orderBy: { nextFollowUpAt: "asc" },
      take: MAX_ROWS,
    }),
    await db.lead.findMany({
      where: { ...mine, status: { in: [...PENDING_SALES_STATUSES] }, createdAt: { lt: since } },
      select: { id: true, serviceType: true, reference: true, createdAt: true, status: true, updatedAt: true, customer: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
      take: MAX_ROWS,
    }),
    await db.booking.findMany({
      where: { createdAt: { gte: since, lte: now }, ...(userId ? { lead: { assignedStaffId: userId } } : {}) },
      select: { bookingId: true, createdAt: true, status: true, lead: { select: { serviceType: true } }, customer: { select: { name: true } }, serviceStatus: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
    await db.task.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, ...(userId ? { assignedToId: userId } : {}) },
      select: { title: true, priority: true, status: true, dueDate: true, createdAt: true, assignedTo: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: MAX_ROWS,
    }),
    await db.document.findMany({
      where: {
        status: "RECEIVED",
        purgedAt: null,
        ...(userId ? { OR: [{ lead: { assignedStaffId: userId } }, { leadId: null, booking: { lead: { assignedStaffId: userId } } }] } : {}),
      },
      select: { type: true, updatedAt: true, passenger: { select: { fullName: true } }, booking: { select: { bookingId: true } }, lead: { select: { reference: true, serviceType: true, createdAt: true } } },
      orderBy: { updatedAt: "asc" },
      take: MAX_ROWS,
    }),
    await db.auditTrail.findMany({
      where: { entityType: "Booking", action: "SLA_ESCALATED", timestamp: { gte: since, lte: now } },
      select: { entityId: true, note: true, timestamp: true },
      orderBy: { timestamp: "desc" },
      take: MAX_ROWS,
    }),
  ];
  const escalationBookings = await db.booking.findMany({
    where: { id: { in: [...new Set(escalations.map((row) => row.entityId))] }, ...(userId ? { lead: { assignedStaffId: userId } } : {}) },
    select: { id: true, bookingId: true },
  });
  const bookingRef = new Map(escalationBookings.map((row) => [row.id, row.bookingId]));
  const delays = (input.delays ?? (await getOpenDelayRecords())).filter((record) => !userId || record.staffId === userId);
  const ref = leadReference;

  return [
    { title: "New Leads", group: "Sales", columns: ["Lead", "Service", "Customer", "Mobile", "Status", "Created"], rows: newLeads.map((lead) => [ref(lead), SERVICE_TYPE_LABELS[lead.serviceType], lead.customer.name, lead.customer.mobile, label(lead.status), fmt(lead.createdAt, offsetMs)]) },
    { title: "Follow-ups Due", group: "Sales", columns: ["Lead", "Service", "Customer", "Follow-up due", "Note"], rows: followUps.map((lead) => [ref(lead), SERVICE_TYPE_LABELS[lead.serviceType], lead.customer.name, fmt(lead.nextFollowUpAt, offsetMs), lead.followUpNote ?? ""]) },
    { title: "Pending Sales Actions", group: "Sales", columns: ["Lead", "Service", "Customer", "Status", "Last update"], rows: pendingLeads.map((lead) => [ref(lead), SERVICE_TYPE_LABELS[lead.serviceType], lead.customer.name, label(lead.status), fmt(lead.updatedAt, offsetMs)]) },
    { title: "New Bookings", group: "Operations", columns: ["Booking", "Service", "Customer", "Status", "Created"], rows: newBookings.map((booking) => [booking.bookingId, SERVICE_TYPE_LABELS[booking.lead.serviceType], booking.customer.name, booking.serviceStatus?.name ?? label(booking.status), fmt(booking.createdAt, offsetMs)]) },
    { title: "Pending Tasks", group: "Operations", columns: ["Task", "Priority", "Status", "Due", ...(userId ? [] : ["Assigned to"])], rows: tasks.map((task) => [task.title, label(task.priority), label(task.status), fmt(task.dueDate, offsetMs), ...(userId ? [] : [task.assignedTo?.name ?? "Unassigned"])]) },
    {
      title: "Documents to Review",
      group: "Operations",
      columns: ["Document", "Passenger", "Booking / Lead", "Uploaded"],
      rows: documents.map((doc) => [doc.type, doc.passenger?.fullName ?? "", doc.booking?.bookingId ?? (doc.lead ? leadReference({ ...doc.lead, id: "" }) : ""), fmt(doc.updatedAt, offsetMs)]),
    },
    { title: "Delayed Bookings & Tasks", group: "Operations", columns: ["Booking", "Service", "Customer", "Reason", "Hours late"], rows: delays.map((record) => [record.bookingReference, record.serviceLabel, record.customerName, record.reason, Math.round(record.delayHours)]) },
    {
      title: "SLA Escalations",
      group: "Operations",
      columns: ["Booking", "When", "Detail"],
      rows: escalations.filter((row) => bookingRef.has(row.entityId)).map((row) => [bookingRef.get(row.entityId) ?? "", fmt(row.timestamp, offsetMs), row.note ?? ""]),
    },
  ];
}

/** A finance / MIS report as a section (Admin reports only). */
async function reportSection(key: string, title: string, from: Date, to: Date): Promise<ReportSection | null> {
  const report = getReport(key);
  if (!report) return null;
  try {
    const result: ReportResult = await report.run({ from, to });
    return {
      title,
      group: "Finance",
      columns: result.columns.map((column) => column.label),
      rows: result.rows.map((row) => result.columns.map((column) => row[column.key] ?? "")),
    };
  } catch (error) {
    console.error("[staff-reports] report", key, error instanceof Error ? error.message : "error");
    return { title, group: "Finance", columns: ["Note"], rows: [["This report couldn't be built — open it in Admin → Reports."]] };
  }
}

/**
 * Client doc 16 Nov (N12 / N13) — the Admin report for a period: sales / operations summaries, leads, bookings,
 * pending tasks, delays, SLA escalations, P&L, revenue, payments collected and refunds — one tab each.
 */
export async function buildAdminSections(input: { from: Date; to: Date; offsetMs: number }): Promise<ReportSection[]> {
  const { from, to, offsetMs } = input;
  const sections: ReportSection[] = [];
  const sales = await reportSection("sales-mis", "Sales Summary", from, to);
  if (sales) sections.push({ ...sales, group: "Sales" });
  const ops = await reportSection("operations-mis", "Operations Summary", from, to);
  if (ops) sections.push({ ...ops, group: "Operations" });

  const leads = await db.lead.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { id: true, serviceType: true, reference: true, createdAt: true, status: true, source: true, customer: { select: { name: true } }, assignedStaff: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  sections.push({ title: "Leads", group: "Sales", columns: ["Lead", "Service", "Customer", "Status", "Source", "POC", "Created"], rows: leads.map((lead) => [leadReference(lead), SERVICE_TYPE_LABELS[lead.serviceType], lead.customer.name, label(lead.status), lead.source ?? "", lead.assignedStaff?.name ?? "Unassigned", fmt(lead.createdAt, offsetMs)]) });
  const bookings = await db.booking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { bookingId: true, createdAt: true, status: true, lead: { select: { serviceType: true, assignedStaff: { select: { name: true } } } }, customer: { select: { name: true } }, serviceStatus: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  sections.push({ title: "Bookings", group: "Operations", columns: ["Booking", "Service", "Customer", "Status", "POC", "Created"], rows: bookings.map((booking) => [booking.bookingId, SERVICE_TYPE_LABELS[booking.lead.serviceType], booking.customer.name, booking.serviceStatus?.name ?? label(booking.status), booking.lead.assignedStaff?.name ?? "Unassigned", fmt(booking.createdAt, offsetMs)]) });
  const completed = await db.booking.count({ where: { status: "COMPLETED", updatedAt: { gte: from, lte: to } } });
  sections.push({ title: "Completed Work", group: "Operations", columns: ["Metric", "Value"], rows: [["Bookings completed", completed], ["Bookings created", bookings.length], ["Leads created", leads.length]] });

  const actions = await buildActionSections({ userId: null, since: from, now: to, offsetMs });
  for (const title of ["Pending Tasks", "Delayed Bookings & Tasks", "SLA Escalations"]) {
    const section = actions.find((row) => row.title === title);
    if (section) sections.push(section);
  }

  try {
    const management = await buildManagementReport({ from, to });
    sections.push({ title: "P&L", group: "Finance", columns: ["Line", "Amount", "Previous period", "Detail"], rows: management.lines.map((line) => [line.label, Math.round(line.value * 100) / 100, Math.round(line.previousValue * 100) / 100, line.detail]) });
  } catch (error) {
    console.error("[staff-reports] P&L", error instanceof Error ? error.message : "error");
  }
  for (const [key, title] of [
    ["revenue-mis", "Revenue"],
    ["collection", "Payments Collected"],
  ] as const) {
    const section = await reportSection(key, title, from, to);
    if (section) sections.push(section);
  }
  const refunds = await db.refund.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { refundAmount: true, status: true, createdAt: true, reason: true, payment: { select: { booking: { select: { bookingId: true, customer: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  sections.push({ title: "Refunds", group: "Finance", columns: ["Booking", "Customer", "Amount", "Status", "Raised", "Reason"], rows: refunds.map((refund) => [refund.payment.booking.bookingId, refund.payment.booking.customer.name, Number(refund.refundAmount), label(refund.status), fmt(refund.createdAt, offsetMs), refund.reason ?? ""]) });
  return sections;
}

export function sectionsToSheets(sections: ReportSection[]): XlsxSheet[] {
  const summary: XlsxSheet = { name: "Summary", rows: [["Section", "Group", "Items"], ...sections.map((section) => [section.title, section.group, section.rows.length])] };
  return [summary, ...sections.map((section) => ({ name: section.title, rows: [section.columns, ...section.rows] }))];
}

/** The email body: the per-section counts, then the first rows of each non-empty section (the Excel has them all). */
export function sectionsToHtml(sections: ReportSection[], previewRows = 10): string {
  const cell = (value: XlsxCell) => `<td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${escapeHtml(value === null || value === undefined ? "" : String(value))}</td>`;
  const summary = `<table style="border-collapse:collapse;font-size:13px;margin:0 0 16px"><tr><th style="text-align:left;padding:4px 8px">Section</th><th style="text-align:right;padding:4px 8px">Items</th></tr>${sections
    .map((section) => `<tr>${cell(`${section.group} — ${section.title}`)}<td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${section.rows.length}</td></tr>`)
    .join("")}</table>`;
  const details = sections
    .filter((section) => section.rows.length > 0)
    .map(
      (section) =>
        `<h3 style="font-size:14px;margin:16px 0 6px">${escapeHtml(section.title)} (${section.rows.length})</h3><table style="border-collapse:collapse;font-size:12px"><tr>${section.columns
          .map((column) => `<th style="text-align:left;padding:4px 8px;background:#f3f4f6">${escapeHtml(column)}</th>`)
          .join("")}</tr>${section.rows
          .slice(0, previewRows)
          .map((row) => `<tr>${row.map(cell).join("")}</tr>`)
          .join("")}</table>${section.rows.length > previewRows ? `<p style="font-size:12px;color:#6b7280">… and ${section.rows.length - previewRows} more in the attached Excel.</p>` : ""}`
    )
    .join("");
  return summary + details;
}
