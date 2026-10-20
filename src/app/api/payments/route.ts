import type { NextRequest } from "next/server";
import { serviceDetailsLine } from "@/lib/crm/service-details";
import { paymentListQuerySchema } from "@/lib/validation/payment-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { countryFlagEmoji } from "@/lib/countries/flag";
import { processingLabel, resolveSubServices } from "@/lib/crm/list-labels";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = paymentListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo, sort, page, pageSize } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(!isServiceScopeUnrestricted(auth.session) ? { booking: { lead: serviceTypeCondition(auth.session) } } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { gatewayRef: { contains: search, mode: "insensitive" as const } },
            { booking: { bookingId: { contains: search, mode: "insensitive" as const } } },
            { booking: { customer: { name: { contains: search, mode: "insensitive" as const } } } },
            { booking: { customer: { mobile: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [total, payments] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      include: { booking: { include: { customer: true, lead: { include: { country: { select: { name: true, code: true, flagOverride: true } } } } } } },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const subServices = await resolveSubServices(payments.map((payment) => ({ serviceType: payment.booking.lead.serviceType, details: payment.booking.lead.details })));
  // Client doc 2026-10-20 (L8) — Service Details in its own column, as on the Bookings table.
  const airlineCodes = [...new Set(payments.map((payment) => (payment.booking.lead.details as Record<string, unknown> | null)?.airline).filter((code): code is string => typeof code === "string"))];
  const airlineNames = new Map(
    airlineCodes.length > 0 ? (await db.airline.findMany({ where: { code: { in: airlineCodes } }, select: { code: true, name: true } })).map((airline) => [airline.code, airline.name]) : []
  );
  const items = payments.map((payment, index) => ({
    id: payment.id,
    amount: payment.amount,
    gstAmount: payment.gstAmount,
    gatewayFee: payment.gatewayFee,
    status: payment.status,
    method: payment.method,
    gatewayRef: payment.gatewayRef,
    createdAt: payment.createdAt,
    bookingId: payment.bookingId,
    bookingDisplayId: payment.booking.bookingId,
    leadReferenceId: leadReference(payment.booking.lead),
    customer: { name: payment.booking.customer.name, mobile: payment.booking.customer.mobile, email: payment.booking.customer.email },
    // Client testing 2026-10-09 (E13) — the shared list layout.
    serviceType: payment.booking.lead.serviceType,
    subService: subServices[index],
    serviceDetails: serviceDetailsLine(payment.booking.lead.serviceType, payment.booking.lead.details, {
      airlineName: airlineNames.get(String((payment.booking.lead.details as Record<string, unknown> | null)?.airline ?? "")) ?? null,
    }),
    processing: processingLabel(payment.booking.lead.serviceType, payment.booking.lead.details),
    paxCount: payment.booking.lead.paxCount,
    countryName: payment.booking.lead.country?.name ?? null,
    countryFlag: payment.booking.lead.country ? countryFlagEmoji(payment.booking.lead.country) : null,
    countryCode: payment.booking.lead.country?.code ?? null,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
