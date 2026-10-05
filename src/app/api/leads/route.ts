import type { NextRequest } from "next/server";
import { leadListQuerySchema } from "@/lib/validation/lead-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { isAbandonedDraftDetails } from "@/lib/leads/abandoned-draft";
import { isUrgentRequest } from "@/lib/crm/urgency";
import { leadListWhere } from "@/lib/leads/list-where";
import { subServiceLabel } from "@/lib/leads/sub-service-label";
import { PAYMENT_FAILED_STATUSES, latestBookingPaymentSelect, latestPaymentFailedStatus } from "@/lib/crm/payment-failed";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = leadListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { serviceType, paymentFailed, sort, page, pageSize } = parsed.data;

  // P21 item 2 — "latest booking's latest payment" can't be expressed as a
  // Prisma where clause, so narrow to leads with ANY failed/expired payment
  // first (a small set), resolve "latest" in JS, then filter the real
  // paginated query by those ids so count/pagination stay correct.
  let paymentFailedLeadIds: string[] | undefined;
  if (paymentFailed) {
    const candidates = await db.lead.findMany({
      where: {
        ...serviceTypeCondition(auth.session, serviceType),
        bookings: { some: { payments: { some: { status: { in: PAYMENT_FAILED_STATUSES } } } } },
      },
      select: { id: true, bookings: latestBookingPaymentSelect },
    });
    paymentFailedLeadIds = candidates.filter((lead) => latestPaymentFailedStatus(lead.bookings) !== null).map((lead) => lead.id);
  }

  const where = leadListWhere(auth.session, parsed.data, paymentFailedLeadIds ? { id: { in: paymentFailedLeadIds } } : {});


  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      include: { customer: true, assignedStaff: true, country: { select: { name: true } }, bookings: latestBookingPaymentSelect },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = leads.map((lead) => ({
    id: lead.id,
    referenceId: leadReference(lead),
    serviceType: lead.serviceType,
    status: lead.status,
    temperature: lead.temperature,
    source: lead.source,
    createdAt: lead.createdAt,
    countryName: lead.country?.name ?? null,
    travelDate: lead.travelDate ? lead.travelDate.toISOString().slice(0, 10) : null,
    paxCount: lead.paxCount,
    subService: subServiceLabel(lead.details),
    urgent: isUrgentRequest(lead.serviceType, lead.details),
    /** P21 item 3 — a step-1-only draft from an abandoned website form. */
    abandoned: isAbandonedDraftDetails(lead.details),
    /** P21 item 2 — FAILED/EXPIRED when the latest booking's latest payment didn't go through, else null. */
    paymentFailedStatus: latestPaymentFailedStatus(lead.bookings),
    customer: { name: lead.customer.name, mobile: lead.customer.mobile, email: lead.customer.email },
    // Step 50 — `active` lets the UI show "Unassigned (was: Name)" for a
    // record whose assignee has since been deactivated, instead of quietly
    // rendering a name that no longer means the lead has an active owner.
    assignedStaff: lead.assignedStaff
      ? { id: lead.assignedStaff.id, name: lead.assignedStaff.name, active: lead.assignedStaff.active }
      : null,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
