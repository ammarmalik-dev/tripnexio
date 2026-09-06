import type { NextRequest } from "next/server";
import { createBookingSchema } from "@/lib/validation/booking-schema";
import { bookingListQuerySchema } from "@/lib/validation/booking-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { placeholderBookingId } from "@/lib/bookings/reference";
import { isExpiredNow } from "@/lib/quotations/sync-expiry";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = bookingListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, sort, page, pageSize } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { bookingId: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { customer: { mobile: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, bookings] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: {
        customer: true,
        lead: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = bookings.map((booking) => ({
    id: booking.id,
    bookingId: booking.bookingId,
    status: booking.status,
    createdAt: booking.createdAt,
    serviceType: booking.lead.serviceType,
    leadId: booking.leadId,
    leadReferenceId: formatLeadReference(booking.lead.serviceType, booking.leadId),
    customer: { name: booking.customer.name, mobile: booking.customer.mobile },
    latestPayment: booking.payments[0] ? { id: booking.payments[0].id, status: booking.payments[0].status } : null,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const quotation = await db.quotation.findUnique({
    where: { id: parsed.data.quotationId },
    include: { lead: true },
  });
  if (!quotation) return jsonError(404, "Quotation not found.");
  if (!quotation.isSelected) {
    return jsonError(409, "Select this quotation before booking it.", {
      quotationId: ["This quotation hasn't been selected yet."],
    });
  }
  if (isExpiredNow(quotation)) {
    return jsonError(409, "This quotation has expired.", { quotationId: ["This quotation has expired."] });
  }

  const existingActiveBooking = await db.booking.findFirst({
    where: { leadId: quotation.leadId, status: { not: "CANCELLED" } },
  });
  if (existingActiveBooking) {
    return jsonError(409, "This lead already has an active booking.");
  }

  // bookingId gets its real TNX-XX-XXXXXX value once payment succeeds (see
  // /api/payments/[id]/mark-success) — this placeholder just satisfies the
  // column's NOT NULL/unique constraint until then.
  const booking = await db.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingId: placeholderBookingId(),
        leadId: quotation.leadId,
        customerId: quotation.lead.customerId,
        status: "PENDING",
      },
    });

    await writeAudit(tx, {
      entityType: "Booking",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Booking initiated from quotation ${quotation.id} (by ${session.name})`,
    });

    return created;
  });

  return jsonSuccess(booking, 201);
}
