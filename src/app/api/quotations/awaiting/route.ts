import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { ABANDONED_DRAFT_SOURCE } from "@/lib/leads/abandoned-draft";
import type { Prisma, ServiceType } from "@/generated/prisma/client";

/** The quote-review services — a full-form submission waits here for staff to build a quotation. */
const AWAITING_QUOTE_SERVICES = ["FLIGHT_SPECIAL_FARE", "VISA_EXTENSION", "VISA_CHANGE"] as const satisfies readonly ServiceType[];

const awaitingQuerySchema = z.object({
  serviceType: z.enum(AWAITING_QUOTE_SERVICES).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * P21 — "Awaiting quotation" queue on /crm/quotations. Leads of the three
 * quote-review services with no quotation yet, not Converted/Lost/Closed,
 * and not an abandoned step-1 draft (a draft isn't a full-form submission —
 * it becomes one, and appears here, once createLeadFromSubmission takes it
 * over and replaces its `source`). Newest first. Same permission as the
 * quotations list.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const parsed = awaitingQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { serviceType, search, page, pageSize } = parsed.data;

  // Service-scoped staff only ever see their own services (an out-of-scope
  // filter yields an always-empty `in: []`), intersected with the 3 services.
  const scoped = serviceTypeCondition(auth.session, serviceType);
  const where: Prisma.LeadWhereInput = {
    AND: [
      { serviceType: { in: [...AWAITING_QUOTE_SERVICES] } },
      scoped,
      { status: { notIn: ["CONVERTED", "LOST", "CLOSED"] } },
      { quotations: { none: {} } },
      // `source` is nullable — a plain `not` would also drop NULL-source leads.
      { OR: [{ source: null }, { source: { not: ABANDONED_DRAFT_SOURCE } }] },
      ...(search
        ? [
            {
              OR: [
                { reference: { contains: search, mode: "insensitive" as const } },
                { customer: { name: { contains: search, mode: "insensitive" as const } } },
                { customer: { mobile: { contains: search, mode: "insensitive" as const } } },
              ],
            },
          ]
        : []),
    ],
  };

  try {
    const [total, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        include: { customer: { select: { name: true, mobile: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = leads.map((lead) => ({
      leadId: lead.id,
      leadReferenceId: leadReference(lead),
      serviceType: lead.serviceType,
      status: lead.status,
      source: lead.source,
      customer: { name: lead.customer.name, mobile: lead.customer.mobile },
      createdAt: lead.createdAt,
    }));

    return jsonSuccess({ items, total, page, pageSize });
  } catch (error) {
    console.error("[api/quotations/awaiting]", describeError(error));
    return jsonError(500, "Couldn't load the awaiting-quotation queue.");
  }
}
