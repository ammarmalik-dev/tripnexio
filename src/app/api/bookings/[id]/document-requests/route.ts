import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { createTask } from "@/lib/tasks/create-task";
import { applyBookingDocumentEvent } from "@/lib/service-status/document-events";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({
  passengerId: z.string().min(1, "Select the passenger"),
  documentName: z.string().trim().min(2, "Enter the document name").max(80, "Name is too long"),
  reason: z.string().trim().min(3, "Tell the customer why it's needed").max(300, "Reason is too long"),
});

/**
 * P11 — staff ask a passenger for one extra document (e.g. the embassy wants
 * a bank statement). Creates a REQUIRED document with the reason, a staff
 * Task to collect it, and sends DOCUMENTS_REQUIRED with a secure upload link
 * (the booking's own payment/documents page, which accepts this slot).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { passengerId, documentName, reason } = parsed.data;

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { include: { passenger: { select: { id: true, fullName: true } } } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  const passenger = booking.passengers.find((row) => row.passenger.id === passengerId)?.passenger;
  if (!passenger) return jsonError(400, "That passenger isn't on this booking.", { passengerId: ["Select a passenger on this booking."] });

  let statusNotifications: StatusNotification[] = [];
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: { bookingId: booking.id, passengerId, type: documentName, status: "REQUIRED", requestReason: reason },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "REQUESTED",
      byUserId: session.id,
      note: `"${documentName}" requested from ${passenger.fullName}: ${reason} (by ${session.name})`,
    });
    await createTask(tx, {
      type: "DOCUMENT_COLLECTION",
      title: `Collect ${documentName} from ${passenger.fullName}`,
      reason,
      entityType: "Document",
      entityId: created.id,
      leadId: booking.leadId,
      bookingId: booking.id,
      passengerId,
      serviceType: booking.lead.serviceType,
    });
    statusNotifications = await applyBookingDocumentEvent(tx, booking.id, { userId: session.id, actorLabel: `by ${session.name}` });
    return created;
  });

  await dispatchStatusNotifications(statusNotifications);
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
    emailTo: booking.customer.email,
    whatsappTo: toWhatsAppId(booking.customer.mobile),
    smsTo: toWhatsAppId(booking.customer.mobile),
    variables: {
      customerName: booking.customer.name,
      documentName,
      leadReference: leadReference(booking.lead),
      requestReason: reason,
      uploadLink: booking.customerToken ? `${siteConfig.url}/pay/${booking.customerToken}` : `${siteConfig.url}/account`,
    },
    auditTarget: { entityType: "Document", entityId: document.id },
  });

  return jsonSuccess(document, 201);
}
