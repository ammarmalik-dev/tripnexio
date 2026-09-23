import type { NextRequest } from "next/server";
import { updateDocumentStatusSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { resolveDocumentRecipient } from "@/lib/documents/resolve-recipient";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import type { NotificationEvent } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { createTask, autoCompleteTasksForEntity } from "@/lib/tasks/create-task";

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

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${existing.status} -> ${parsed.data.status} (by ${session.name})`,
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

    return result;
  });

  const EVENT_BY_STATUS: Partial<Record<typeof updated.status, NotificationEvent>> = {
    MISSING: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
    VERIFIED: NOTIFICATION_EVENTS.DOCUMENT_APPROVED,
    REJECTED: NOTIFICATION_EVENTS.DOCUMENT_REJECTED,
  };
  const event = EVENT_BY_STATUS[updated.status];
  if (event) {
    const recipient = await resolveDocumentRecipient(updated);
    if (recipient) {
      await notifyCustomer({
        event,
        emailTo: recipient.email,
        whatsappTo: toWhatsAppId(recipient.mobile),
        variables: { customerName: recipient.customerName, documentName: updated.type, leadReference: recipient.leadReference },
        auditTarget: { entityType: "Document", entityId: updated.id },
      });
    }
  }

  return jsonSuccess(updated);
}
