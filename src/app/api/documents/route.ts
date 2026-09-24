import type { NextRequest } from "next/server";
import { createDocumentSchema } from "@/lib/validation/document-schema";
import { documentListQuerySchema } from "@/lib/validation/document-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess, serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import { resolveDocumentRecipient } from "@/lib/documents/resolve-recipient";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

/**
 * Two modes: pass `bookingId`/`passengerId` for the documents scoped to one
 * booking or passenger (used by the Lead/Booking detail pages); pass neither
 * for the `/crm/documents` review queue — every document in the system,
 * optionally filtered by status.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("documents.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId") ?? undefined;
  const passengerId = searchParams.get("passengerId") ?? undefined;

  if (bookingId || passengerId) {
    if (bookingId) {
      const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { lead: true } });
      if (!booking) return jsonError(404, "Booking not found.");
      const scopeError = assertServiceAccess(auth.session, booking.lead.serviceType);
      if (scopeError) return scopeError;
    }
    // A passenger-only lookup (no bookingId) isn't service-scoped — a
    // passenger can have leads across multiple services, so there's no
    // single serviceType to check (see serviceTypeCondition's own note on
    // Document below for the same reasoning applied to the review queue).
    const documents = await db.document.findMany({
      where: { bookingId, passengerId },
      orderBy: { createdAt: "desc" },
    });
    return jsonSuccess(documents);
  }

  const parsed = documentListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { status, search, sort, page, pageSize } = parsed.data;

  // A document scoped to a Passenger only (no Booking) has no single
  // derivable serviceType — a passenger can have leads across multiple
  // services — so it's never hidden by scoping (shown to anyone with
  // documents.view, regardless of their allowedServiceTypes); only a
  // Booking-linked document is actually filtered.
  const where = {
    ...(status ? { status: { in: status } } : {}),
    ...(!isServiceScopeUnrestricted(auth.session)
      ? { OR: [{ bookingId: null }, { booking: { lead: serviceTypeCondition(auth.session) } }] }
      : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { type: { contains: search, mode: "insensitive" as const } },
                { booking: { bookingId: { contains: search, mode: "insensitive" as const } } },
                { passenger: { fullName: { contains: search, mode: "insensitive" as const } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [total, documents] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      include: {
        passenger: { include: { customer: true } },
        booking: { include: { customer: true, lead: true } },
      },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = documents.map((document) => {
    const customer = document.booking?.customer ?? document.passenger?.customer ?? null;
    return {
      id: document.id,
      type: document.type,
      status: document.status,
      fileUrl: document.fileUrl,
      createdAt: document.createdAt,
      passenger: document.passenger ? { id: document.passenger.id, fullName: document.passenger.fullName } : null,
      booking: document.booking
        ? {
            id: document.booking.id,
            bookingId: document.booking.bookingId,
            leadReferenceId: formatLeadReference(document.booking.lead.serviceType, document.booking.leadId),
          }
        : null,
      customer: customer ? { name: customer.name, mobile: customer.mobile } : null,
    };
  });

  return jsonSuccess({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.passengerId) {
    const passenger = await db.passenger.findUnique({ where: { id: parsed.data.passengerId } });
    if (!passenger) {
      return jsonError(400, "Passenger not found.", { passengerId: ["No passenger with this id."] });
    }
  }
  if (parsed.data.bookingId) {
    const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { lead: true } });
    if (!booking) {
      return jsonError(400, "Booking not found.", { bookingId: ["No booking with this id."] });
    }
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;
  }

  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        passengerId: parsed.data.passengerId,
        bookingId: parsed.data.bookingId,
        type: parsed.data.type,
        status: parsed.data.status ?? "REQUIRED",
      },
    });

    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Document requirement "${created.type}" created (by ${session.name})`,
    });

    return created;
  });

  const recipient = await resolveDocumentRecipient(document);
  if (recipient) {
    await notifyCustomer({
      event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
      emailTo: recipient.email,
      whatsappTo: toWhatsAppId(recipient.mobile),
      variables: { customerName: recipient.customerName, documentName: document.type, leadReference: recipient.leadReference },
      auditTarget: { entityType: "Document", entityId: document.id },
    });
  }

  return jsonSuccess(document, 201);
}
