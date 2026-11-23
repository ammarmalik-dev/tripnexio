import type { NextRequest } from "next/server";
import { bookingActionBlock } from "@/lib/bookings/action-block";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { writeAudit } from "@/lib/audit/log";
import { createTask } from "@/lib/tasks/create-task";
import { applyBookingDocumentEvent } from "@/lib/service-status/document-events";
import { sendDocumentsStatusTemplate } from "@/lib/notifications/status-template";
import { dispatchStatusNotifications, hasReachedStatusEvent, type StatusNotification } from "@/lib/service-status/engine";
import type { ServiceStatusSystemEvent } from "@/lib/service-status/events";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
import { documentsByPassengerSummary } from "@/lib/documents/review-round";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client doc 16 Nov (G4) — the step after which a service's additional documents may be requested. */
const ADDITIONAL_DOCS_AFTER: Partial<Record<string, ServiceStatusSystemEvent>> = {
  NEW_VISA: "EMBASSY_APPLIED",
  VISA_CHANGE: "EMBASSY_APPLIED",
  VISA_EXTENSION: "EMBASSY_APPLIED",
  OTB: "OTB_SUBMITTED",
};

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
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "booking", id);
  if (ownershipError) return ownershipError;
  // Client doc 16 Nov (H3 / H4) — nothing more on a cancelled booking, or while a refund on it is open.
  const actionBlock = await bookingActionBlock(id);
  if (actionBlock) return jsonError(409, actionBlock);

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
  const actionError = assertServiceAction(session, booking.lead.serviceType, "VALIDATE_DOCUMENTS");
  if (actionError) return actionError;
  const passengerOf = (passengerId: string) => booking.passengers.find((row) => row.passenger.id === passengerId)?.passenger;
  if (items.some((item) => !passengerOf(item.passengerId))) {
    return jsonError(400, "That passenger isn't on this booking.", { passengerId: ["Select a passenger on this booking."] });
  }
  // Client doc 16 Nov (H2 / F-partial cancellation) — never ask a cancelled (or rejected) passenger for documents.
  const inactive = booking.passengers.filter((row) => row.outcome === "CANCELLED" || row.outcome === "REJECTED").map((row) => row.passenger.id);
  if (items.some((item) => inactive.includes(item.passengerId))) {
    return jsonError(409, "That passenger is cancelled / rejected — documents are requested only for active passengers.", { passengerId: ["Pick an active passenger."] });
  }
  // Client doc 16 Nov (G4) — additional documents come from the Document Master list.
  const master = await db.documentType.findMany({ where: { active: true, name: { in: items.map((item) => item.documentName) } }, select: { name: true } });
  const known = new Set(master.map((row) => row.name));
  const unknown = items.find((item) => !known.has(item.documentName));
  if (unknown) return jsonError(400, `"${unknown.documentName}" isn't in the Document Master list — pick a document from the list.`, { documentName: ["Pick from the list."] });
  // Client doc 16 Nov (G4 / F5 / C2) — for visa services and OTB, additional documents are asked only after the
  // application went to the embassy / airline (before that the configured checklist applies).
  const stageEvent = ADDITIONAL_DOCS_AFTER[booking.lead.serviceType];
  if (stageEvent && !(await hasReachedStatusEvent(booking.id, stageEvent))) {
    return jsonError(409, `Additional documents can be requested only after the application is ${booking.lead.serviceType === "OTB" ? "sent to the airline" : "applied to the embassy"}.`);
  }

  // Client doc 16 Nov (E7) — a document already validated for that passenger is never asked for again.
  const validated = await db.document.findMany({
    where: { passengerId: { in: items.map((item) => item.passengerId) }, type: { in: items.map((item) => item.documentName) }, status: "VERIFIED", purgedAt: null, OR: [{ bookingId: booking.id }, { leadId: booking.leadId }] },
    select: { passengerId: true, type: true },
  });
  const again = items.find((item) => validated.some((doc) => doc.passengerId === item.passengerId && doc.type === item.documentName));
  if (again) return jsonError(409, `${passengerOf(again.passengerId)!.fullName}'s "${again.documentName}" is already validated — it isn't requested again.`);

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

  const sent = await dispatchStatusNotifications(statusNotifications);
  // Client doc 2026-10-20 (K5) — services on the client's templates get one documents message (the status's,
  // or the "Documents Pending" one when the booking is already past the document stage).
  if (sent > 0 || (await sendDocumentsStatusTemplate(booking.id, "REQUESTED"))) {
    return jsonSuccess(documents.length === 1 ? documents[0] : documents, 201);
  }
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
      uploadLink: booking.customerToken ? `${siteConfig.url}/pay/${booking.customerToken}#documents` : `${siteConfig.url}/account`,
    },
    auditTarget: { entityType: "Document", entityId: documents[0].id },
  });

  return jsonSuccess(documents.length === 1 ? documents[0] : documents, 201);
}
