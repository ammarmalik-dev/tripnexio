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
import { documentsByPassengerSummary } from "@/lib/documents/review-round";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const itemSchema = z.object({
  passengerId: z.string().min(1, "Select the passenger"),
  documentName: z.string().trim().min(2, "Enter the document name").max(80, "Name is too long"),
  reason: z.string().trim().min(3, "Tell the customer why it's needed").max(300, "Reason is too long"),
});
// Client doc 2026-10-15 (I6) — several documents (for one or more passengers) in one request; a single item still works.
const requestSchema = z.union([z.object({ items: z.array(itemSchema).min(1, "Add a document").max(20, "Up to 20 at a time") }), itemSchema]);

/**
 * P11 — staff ask passengers for extra documents (client doc 2026-10-15: several at once, one message) (e.g. the embassy wants
 * a bank statement). Creates a MISSING ("Additional Documents Required") document with the reason, a staff
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
  const items = "items" in parsed.data ? parsed.data.items : [parsed.data];

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { include: { passenger: { select: { id: true, fullName: true } } } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  const passengerOf = (passengerId: string) => booking.passengers.find((row) => row.passenger.id === passengerId)?.passenger;
  if (items.some((item) => !passengerOf(item.passengerId))) {
    return jsonError(400, "That passenger isn't on this booking.", { passengerId: ["Select a passenger on this booking."] });
  }

  let statusNotifications: StatusNotification[] = [];
  const documents = await db.$transaction(async (tx) => {
    const created = [];
    for (const { passengerId, documentName, reason } of items) {
      const passenger = passengerOf(passengerId)!;
      const document = await tx.document.create({
        // Client corrections 2026-10-05: a later request shows as "Additional Required".
        data: { bookingId: booking.id, leadId: booking.leadId, passengerId, type: documentName, status: "MISSING", requestReason: reason },
      });
      await writeAudit(tx, {
        entityType: "Document",
        entityId: document.id,
        action: "REQUESTED",
        byUserId: session.id,
        note: `"${documentName}" requested from ${passenger.fullName}: ${reason} (by ${session.name})`,
      });
      await createTask(tx, {
        type: "DOCUMENT_COLLECTION",
        title: `Collect ${documentName} from ${passenger.fullName}`,
        reason,
        entityType: "Document",
        entityId: document.id,
        leadId: booking.leadId,
        bookingId: booking.id,
        passengerId,
        serviceType: booking.lead.serviceType,
      });
      created.push(document);
    }
    statusNotifications = await applyBookingDocumentEvent(tx, booking.id, { userId: session.id, actorLabel: `by ${session.name}` });
    return created;
  });

  // One message for the whole request: which passenger needs which document (and why).
  const multiplePassengers = new Set(items.map((item) => item.passengerId)).size > 1;
  const documentName = documentsByPassengerSummary(
    items.map((item) => ({ passengerName: multiplePassengers ? passengerOf(item.passengerId)!.fullName : null, label: item.documentName }))
  );
  const reason = [...new Set(items.map((item) => item.reason))].join("; ");

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
    auditTarget: { entityType: "Document", entityId: documents[0].id },
  });

  return jsonSuccess(documents.length === 1 ? documents[0] : documents, 201);
}
