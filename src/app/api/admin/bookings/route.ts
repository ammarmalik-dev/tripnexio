import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { adminBookingsQuerySchema, dateRangeFilter } from "@/lib/validation/admin-monitoring-schemas";
import type { Prisma } from "@/generated/prisma/client";

function textField(details: Prisma.JsonValue, key: string): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, Prisma.JsonValue>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * P24 item 5 — Admin Bookings: a read-only, cross-service booking search
 * with every filter the CRM list doesn't have (country, staff, vendor,
 * per-service status, latest payment status). Rows link to the existing
 * CRM booking detail page for any action.
 *
 * Deliberately modest queries (the local dev DB falls over on large nested
 * includes): one page-sized booking query with small `select`s, then the
 * page's latest payments and selected-quotation vendors in two separate
 * `IN (...)` lookups.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = adminBookingsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const q = parsed.data;

  try {
    const and: Prisma.BookingWhereInput[] = [];

    if (q.serviceType || !isServiceScopeUnrestricted(auth.session)) {
      and.push({ lead: serviceTypeCondition(auth.session, q.serviceType) });
    }
    if (q.status) and.push({ status: q.status });
    if (q.serviceStatusId) and.push({ serviceStatusId: q.serviceStatusId });

    const createdAt = dateRangeFilter(q.dateFrom, q.dateTo);
    if (createdAt) and.push({ createdAt });

    if (q.search) {
      const contains = { contains: q.search, mode: "insensitive" as const };
      and.push({
        OR: [
          { bookingId: contains },
          { lead: { reference: contains } },
          { customer: { name: contains } },
          { customer: { mobile: contains } },
          { customer: { email: contains } },
        ],
      });
    }

    if (q.staffId) {
      and.push({ lead: { assignedStaffId: q.staffId === "unassigned" ? null : q.staffId } });
    }

    if (q.vendorId) {
      and.push({ lead: { quotations: { some: { isSelected: true, vendorId: q.vendorId } } } });
    }

    if (q.countryId) {
      const country = await db.country.findUnique({ where: { id: q.countryId }, select: { id: true, code: true, name: true } });
      if (!country) return jsonSuccess({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
      // Lead.details stores the destination differently per service/flow
      // (a country code, a code in lowercase, the country name, or a
      // Country master id) — match any of them.
      const values = Array.from(new Set([country.code, country.code.toLowerCase(), country.code.toUpperCase(), country.name]));
      and.push({
        lead: {
          OR: [
            ...values.map((value) => ({ details: { path: ["destinationCountry"], equals: value } })),
            ...values.map((value) => ({ details: { path: ["destinationCountryCode"], equals: value } })),
            { details: { path: ["destinationCountryId"], equals: country.id } },
          ],
        },
      });
    }

    if (q.paymentStatus === "NONE") {
      and.push({ payments: { none: {} } });
    } else if (q.paymentStatus) {
      // "Latest payment" status isn't expressible as a Prisma relation
      // filter — resolve the matching booking ids with one small query.
      const rows = await db.$queryRaw<{ bookingId: string }[]>`
        SELECT latest."bookingId" FROM (
          SELECT DISTINCT ON ("bookingId") "bookingId", "status"::text AS status
          FROM "Payment"
          ORDER BY "bookingId", "createdAt" DESC
        ) latest
        WHERE latest.status = ${q.paymentStatus}`;
      and.push({ id: { in: rows.map((row) => row.bookingId) } });
    }

    const where: Prisma.BookingWhereInput = and.length > 0 ? { AND: and } : {};

    const [total, bookings] = await Promise.all([
      db.booking.count({ where }),
      db.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          bookingId: true,
          status: true,
          createdAt: true,
          leadId: true,
          serviceStatus: { select: { name: true } },
          customer: { select: { name: true, mobile: true, email: true } },
          lead: {
            select: {
              id: true,
              reference: true,
              serviceType: true,
              details: true,
              assignedStaff: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const bookingIds = bookings.map((booking) => booking.id);
    const leadIds = bookings.map((booking) => booking.leadId);

    const [payments, selectedQuotations] = await Promise.all([
      bookingIds.length
        ? db.payment.findMany({
            where: { bookingId: { in: bookingIds } },
            orderBy: { createdAt: "desc" },
            select: { bookingId: true, status: true, amount: true, gstAmount: true, gatewayFee: true, couponDiscount: true },
          })
        : Promise.resolve([]),
      leadIds.length
        ? db.quotation.findMany({
            where: { leadId: { in: leadIds }, isSelected: true },
            orderBy: { createdAt: "desc" },
            select: { leadId: true, vendor: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const latestPaymentByBooking = new Map<string, (typeof payments)[number]>();
    for (const payment of payments) {
      if (!latestPaymentByBooking.has(payment.bookingId)) latestPaymentByBooking.set(payment.bookingId, payment);
    }
    const vendorByLead = new Map<string, string>();
    for (const quotation of selectedQuotations) {
      if (!vendorByLead.has(quotation.leadId)) vendorByLead.set(quotation.leadId, quotation.vendor.name);
    }

    const items = bookings.map((booking) => {
      const payment = latestPaymentByBooking.get(booking.id);
      return {
        id: booking.id,
        bookingId: booking.bookingId,
        status: booking.status,
        serviceStatusName: booking.serviceStatus?.name ?? null,
        createdAt: booking.createdAt,
        serviceType: booking.lead.serviceType,
        leadId: booking.lead.id,
        leadReference: leadReference(booking.lead),
        country:
          textField(booking.lead.details, "destinationCountry") ?? textField(booking.lead.details, "destinationCountryCode"),
        assignedStaffName: booking.lead.assignedStaff?.name ?? null,
        vendorName: vendorByLead.get(booking.leadId) ?? null,
        customer: booking.customer,
        latestPayment: payment
          ? {
              status: payment.status,
              total:
                Math.round(
                  (Number(payment.amount) - Number(payment.couponDiscount ?? 0) + Number(payment.gstAmount) + Number(payment.gatewayFee)) * 100
                ) / 100,
            }
          : null,
      };
    });

    return jsonSuccess({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (error) {
    console.error("[api/admin/bookings]", error);
    return jsonError(500, "Couldn't load bookings. Please try again.");
  }
}
