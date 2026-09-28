import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";
import { OUTPUT_DELIVERY_EVENT, OUTPUT_TYPES, OUTPUT_TYPE_LABELS } from "@/lib/outputs/output-types";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const deliverSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES, { error: "Select what you're delivering" }),
  /** The passenger this output belongs to; omit for a booking-level output (e.g. a group package). */
  passengerId: z.string().min(1).nullable().optional(),
  fileBase64: z.string().min(1, "Choose a file"),
});

/**
 * P09 — "Upload & Deliver": staff upload the service result for a passenger
 * (or the whole booking). The file is stored as a delivered Document, the
 * booking moves to its service's matching status, and the customer gets
 * WhatsApp + email with a secure download link (tied to this booking's own
 * token). The delivery time is kept on the document.
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
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { select: { passengerId: true } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  const passengerId = parsed.data.passengerId ?? null;
  if (passengerId && !booking.passengers.some((row) => row.passengerId === passengerId)) {
    return jsonError(400, "That passenger isn't on this booking.", { passengerId: ["Select a passenger on this booking."] });
  }

  let fileUrl: string;
  try {
    fileUrl = (await saveUploadedFile(parsed.data.fileBase64)).url;
  } catch (error) {
    if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
    console.error("[api/bookings/outputs] file save failed", describeError(error));
    return jsonError(500, "Couldn't save the file. Please try again.");
  }

  const label = OUTPUT_TYPE_LABELS[parsed.data.outputType];
  let statusNotification: StatusNotification | null = null;
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: { bookingId: booking.id, passengerId, type: parsed.data.outputType, status: "VERIFIED", fileUrl, deliveredAt: new Date() },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "OUTPUT_DELIVERED",
      byUserId: session.id,
      note: `${label} delivered to the customer (by ${session.name})`,
    });
    statusNotification = await applySystemEvent(tx, {
      scope: "BOOKING",
      entityId: booking.id,
      event: OUTPUT_DELIVERY_EVENT[parsed.data.outputType],
      userId: session.id,
      actorLabel: `by ${session.name}`,
    });
    return created;
  });

  await dispatchStatusNotifications([statusNotification]);
  const downloadLink = booking.customerToken ? `${siteConfig.url}${fileUrl}?token=${booking.customerToken}` : `${siteConfig.url}/account`;
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.OUTPUT_DELIVERED,
    emailTo: booking.customer.email,
    whatsappTo: toWhatsAppId(booking.customer.mobile),
    smsTo: toWhatsAppId(booking.customer.mobile),
    variables: { customerName: booking.customer.name, leadReference: leadReference(booking.lead), documentName: label, downloadLink },
    auditTarget: { entityType: "Document", entityId: document.id },
  });

  return jsonSuccess(document, 201);
}
