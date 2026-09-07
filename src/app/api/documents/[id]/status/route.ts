import type { NextRequest } from "next/server";
import { updateDocumentStatusSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveDocumentRecipient } from "@/lib/documents/resolve-recipient";
import { sendNotificationEmail } from "@/lib/notifications/send-notification-email";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import type { NotificationEvent } from "@/lib/notifications/events";

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
      await sendNotificationEmail({
        event,
        to: recipient.email,
        variables: { customerName: recipient.customerName, documentName: updated.type, leadReference: recipient.leadReference },
        auditTarget: { entityType: "Document", entityId: updated.id },
      });
    }
  }

  return jsonSuccess(updated);
}
