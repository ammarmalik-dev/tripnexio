import type { NextRequest } from "next/server";
import { updateDocumentStatusSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { applyBookingDocumentEvent } from "@/lib/service-status/document-events";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { resolveDocumentRecipient } from "@/lib/documents/resolve-recipient";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { createTask, autoCompleteTasksForEntity } from "@/lib/tasks/create-task";
import { assertValidDocumentTransition } from "@/lib/documents/transitions";
import { notifyDocumentRejected } from "@/lib/staff-notifications/triggers";
import { reviewRoundOutcome } from "@/lib/documents/review-round";
import { isOutputType } from "@/lib/outputs/output-types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const parsed = updateDocumentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Document not found.");

  const transitionError = assertValidDocumentTransition(existing.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);
  const rejectionReason = parsed.data.status === "REJECTED" ? parsed.data.rejectionReason! : null;

  // Resolved once up front (not inside the transaction) since it's only
  // needed to populate the new Task's display fields, same booking->lead
  // join resolveDocumentRecipient already does for the email trigger below.
  const booking = existing.bookingId ? await db.booking.findUnique({ where: { id: existing.bookingId }, include: { lead: true } }) : null;
  // A passenger-only document (no booking) isn't service-scoped — see the
  // list route's own note on why.
  if (booking) {
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;
  }

  let statusNotifications: StatusNotification[] = [];
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({ where: { id }, data: { status: parsed.data.status, rejectionReason } });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${existing.status} -> ${parsed.data.status}${rejectionReason ? `: ${rejectionReason}` : ""} (by ${session.name})`,
    });

    // A document flagged MISSING notifies the customer (see the email
    // trigger below) — this audit row stays as the review queue's visual
    // flag regardless of whether the email actually goes out.
    if (parsed.data.status === "MISSING") {
      await writeAudit(tx, {
        entityType: "Document",
        entityId: id,
        action: "FLAG_MISSING",
        byUserId: session.id,
        note: `Flagged for customer — document "${existing.type}"`,
      });

      // Step 17 (audit §3.8) — "Missing document -> Document Collection
      // Task," wired into this existing flag point rather than a new
      // detection path.
      await createTask(tx, {
        type: "DOCUMENT_COLLECTION",
        title: `Collect missing document: ${existing.type}`,
        reason: `Document flagged MISSING (by ${session.name})`,
        entityType: "Document",
        entityId: id,
        leadId: booking?.leadId,
        bookingId: existing.bookingId,
        passengerId: existing.passengerId,
        serviceType: booking?.lead.serviceType,
      });
    } else {
      // Additive, not a new status/audit behavior of its own — closes out
      // whatever Document Collection task this document's own prior MISSING
      // flag opened, since the thing it asked staff to do no longer applies.
      await autoCompleteTasksForEntity(tx, "Document", id, `Document status moved to ${parsed.data.status} — no longer missing`);
    }

    statusNotifications = await applyBookingDocumentEvent(tx, existing.bookingId, { userId: session.id, actorLabel: `by ${session.name}` });
    return result;
  });
  await dispatchStatusNotifications(statusNotifications);
  if (updated.status === "REJECTED") await notifyDocumentRejected(updated.id, session.id);

  // Client testing 2026-10-09 (E10) — one customer message per review round
  // (src/lib/documents/review-round.ts), not one per document: nothing while a
  // document still waits for staff, then either "documents required" (listing
  // what was rejected / is missing) or "all documents validated".
  const roundDocuments = (
    await db.document.findMany({
      where: updated.bookingId ? { bookingId: updated.bookingId } : { passengerId: updated.passengerId, bookingId: null },
      select: { type: true, status: true, rejectionReason: true, purgedAt: true },
    })
  ).filter((document) => !isOutputType(document.type) && !document.purgedAt);
  const outcome = reviewRoundOutcome(roundDocuments);
  if (outcome.kind !== "IN_PROGRESS") {
    const recipient = await resolveDocumentRecipient(updated);
    if (recipient) {
      await notifyCustomer({
        event: outcome.kind === "ALL_VALIDATED" ? NOTIFICATION_EVENTS.DOCUMENT_APPROVED : NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
        emailTo: recipient.email,
        whatsappTo: toWhatsAppId(recipient.mobile),
        smsTo: toWhatsAppId(recipient.mobile),
        variables: {
          customerName: recipient.customerName,
          documentName: outcome.kind === "ALL_VALIDATED" ? "full set of documents" : outcome.summary,
          leadReference: recipient.leadReference,
        },
        auditTarget: { entityType: "Document", entityId: updated.id },
      });
    }
  }

  return jsonSuccess(updated);
}
