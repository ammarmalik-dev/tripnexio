import type { Booking, Customer, Document, Lead } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { OUTPUT_DELIVERY_EVENT, OUTPUT_TYPE_LABELS, type OutputType } from "./output-types";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "../service-status/engine";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { leadReference } from "../leads/reference";
import { toWhatsAppId } from "../whatsapp/phone";
import { siteConfig } from "../site-config";

/**
 * P09 — records an already-stored output file as delivered: a VERIFIED
 * Document with its delivery time, the booking moved to its service's
 * matching status, and the customer notified (WhatsApp + email) with a
 * secure download link tied to the booking's own token. Shared by staff
 * "Upload & Deliver" and the generated Visa Change package (P14).
 */
export async function deliverOutput(input: {
  booking: Booking & { lead: Lead; customer: Customer };
  outputType: OutputType;
  passengerId: string | null;
  fileUrl: string;
  actor: { userId?: string; label: string };
  /** Audit wording, e.g. "delivered" or "generated and delivered". */
  verb?: string;
}): Promise<Document> {
  const { booking, outputType, passengerId, fileUrl, actor } = input;
  const label = OUTPUT_TYPE_LABELS[outputType];
  let statusNotification: StatusNotification | null = null;

  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: { bookingId: booking.id, passengerId, type: outputType, status: "VERIFIED", fileUrl, deliveredAt: new Date() },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "OUTPUT_DELIVERED",
      byUserId: actor.userId,
      note: `${label} ${input.verb ?? "delivered"} to the customer (${actor.label})`,
    });
    statusNotification = await applySystemEvent(tx, {
      scope: "BOOKING",
      entityId: booking.id,
      event: OUTPUT_DELIVERY_EVENT[outputType],
      userId: actor.userId,
      actorLabel: actor.label,
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

  return document;
}
