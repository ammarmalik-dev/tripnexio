import type { NextRequest } from "next/server";
import { quotationListQuerySchema } from "@/lib/validation/quotation-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import { toCsv } from "@/lib/csv/to-csv";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { Quotation } from "@/generated/prisma/client";

/** Mirrors quotationStatus() in the standalone-list branch of GET /api/quotations — see that route's own doc comment for why status is derived live, not just read off the stored column. */
function quotationStatus(quotation: Pick<Quotation, "isSelected" | "isExpired" | "validityExpiresAt">, now: Date): "SELECTED" | "EXPIRED" | "PENDING" {
  if (quotation.isSelected) return "SELECTED";
  const liveExpired = quotation.isExpired || (quotation.validityExpiresAt !== null && quotation.validityExpiresAt < now);
  if (liveExpired) return "EXPIRED";
  return "PENDING";
}

/**
 * Step 54 — CSV export for the standalone Quotations list, respecting the
 * screen's own active filters. Mirrors GET /api/quotations's standalone-
 * list where-clause exactly, minus pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = quotationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { serviceType, status, search, dateFrom, dateTo } = parsed.data;
  const now = new Date();

  const liveExpiredCondition = { OR: [{ isExpired: true }, { validityExpiresAt: { lt: now } }] };

  const where = {
    ...(status === "SELECTED" ? { isSelected: true } : {}),
    ...(status === "EXPIRED" ? { isSelected: false, ...liveExpiredCondition } : {}),
    ...(status === "PENDING"
      ? { isSelected: false, isExpired: false, OR: [{ validityExpiresAt: null }, { validityExpiresAt: { gte: now } }] }
      : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(serviceType || search || !isServiceScopeUnrestricted(auth.session)
      ? {
          lead: {
            ...serviceTypeCondition(auth.session, serviceType),
            ...(search
              ? {
                  customer: {
                    OR: [
                      { name: { contains: search, mode: "insensitive" as const } },
                      { mobile: { contains: search, mode: "insensitive" as const } },
                    ],
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  const quotations = await db.quotation.findMany({
    where,
    include: { lead: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(quotations, [
    { key: "leadReferenceId", header: "Lead Reference", value: (row) => formatLeadReference(row.lead.serviceType, row.leadId) },
    { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.lead.serviceType] },
    { key: "status", header: "Status", value: (row) => quotationStatus(row, now) },
    { key: "customerName", header: "Customer Name", value: (row) => row.lead.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.lead.customer.mobile },
    { key: "sellingPrice", header: "Selling Price", value: (row) => Number(row.sellingPrice) },
    { key: "margin", header: "Margin (internal)", value: (row) => Number(row.margin) },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quotations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
