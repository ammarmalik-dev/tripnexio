import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { writeAudit } from "@/lib/audit/log";
import { createTask } from "@/lib/tasks/create-task";
import { isExpiredNow } from "@/lib/quotations/sync-expiry";
import { leadReference } from "@/lib/leads/reference";
import { sendSystemAlert } from "@/lib/automation/system-alert";
import { siteConfig } from "@/lib/site-config";
import { describeError } from "@/lib/api/describe-error";
import type { Prisma } from "@/generated/prisma/client";
import { NEW_QUOTE_TASK_TITLE } from "@/lib/quotations/flight-quote";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * P15 — Flight_Special_Fare.md §15 / Locked v2.0 Q16: once a Special Fare
 * quotation expires the customer can press "Request New Quote". The lead is
 * flagged (details.newQuoteRequestedAt), a HIGH-priority staff Task is
 * opened and staff are alerted by email. Staff then revalidate the same
 * quote (existing, audited) or build a new one. Idempotent: pressing it
 * again doesn't open a second task.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "quote-request-new", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "Page not found.");

  const lead = await db.lead.findUnique({
    where: { customerToken: token },
    // P22 — only quotations the customer was actually sent count here, never drafts.
    include: { quotations: { where: { isDraft: false } }, customer: { select: { name: true } }, assignedStaff: { select: { id: true } } },
  });
  if (!lead) return jsonError(404, "Page not found.");
  if (lead.serviceType !== "FLIGHT_SPECIAL_FARE") return jsonError(409, "New quotes can be requested for Special Fare requests only.");

  const booking = await db.booking.findFirst({ where: { leadId: lead.id, status: { not: "CANCELLED" } }, select: { id: true } });
  if (booking) return jsonError(409, "This request already has a booking.");
  const active = lead.quotations.some((quotation) => !isExpiredNow(quotation));
  if (active) return jsonError(409, "You still have a valid quotation — approve it before it expires.");
  if (lead.quotations.length === 0) return jsonError(409, "There's no quotation to renew yet.");

  const openTask = await db.task.findFirst({
    where: { leadId: lead.id, title: NEW_QUOTE_TASK_TITLE, status: { in: ["OPEN", "IN_PROGRESS"] } },
    select: { id: true },
  });
  const reference = leadReference(lead);

  try {
    if (!openTask) {
      await db.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: lead.id },
          data: { details: { ...((lead.details ?? {}) as Record<string, unknown>), newQuoteRequestedAt: new Date().toISOString() } as Prisma.InputJsonValue },
        });
        await writeAudit(tx, {
          entityType: "Lead",
          entityId: lead.id,
          action: "NEW_QUOTE_REQUESTED",
          note: "Customer requested a new Special Fare quote after the quotation expired (quote page)",
        });
        await createTask(tx, {
          type: "QUOTE_FOLLOW_UP",
          priority: "HIGH",
          title: NEW_QUOTE_TASK_TITLE,
          reason: `${reference}: the Special Fare quotation expired and the customer asked for a new one. Reconfirm availability, then revalidate the same quote or build a new one.`,
          entityType: "Lead",
          entityId: lead.id,
          leadId: lead.id,
          serviceType: lead.serviceType,
          dueDate: new Date(Date.now() + 60 * 60 * 1000),
        });
      });
      await sendSystemAlert(
        `New Special Fare quote requested — ${reference}`,
        `${lead.customer.name} asked for a new quote after their Special Fare quotation expired. Open the lead: ${siteConfig.url}/crm/leads/${lead.id}`
      );
    }
    return jsonSuccess({ requested: true });
  } catch (error) {
    console.error("[api/quote/request-new-quote]", describeError(error));
    return jsonError(500, "Couldn't send your request. Please try again or contact us on WhatsApp.");
  }
}
