import type { Booking, Customer, Document, Lead } from "../../generated/prisma/client";
import { ticketDetailsFor } from "./output-notes";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { OUTPUT_DELIVERY_EVENT, OUTPUT_TYPE_LABELS, type OutputType } from "./output-types";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "../service-status/engine";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { leadReference } from "../leads/reference";
import { toWhatsAppId } from "../whatsapp/phone";
import { siteConfig } from "../site-config";
import { offerPostTicketCrossSell } from "../cross-sell/post-ticket";
import { runOcrForDocument } from "../ocr/run-for-document";
import { sendStatusTemplate, statusTemplateFor, usesStatusTemplates } from "../notifications/status-template";

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

  // Client doc 2026-10-20 — a visa / ticket is per passenger: the booking reaches "Visa Approved" /
  // "Ticket Issued" once every passenger still travelling has theirs; until then a visa marks it
  // "Approved for partial applicants" and each delivery still reaches the customer.
  let allCovered = true;
  let someNotApproved = false;
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: { bookingId: booking.id, leadId: booking.leadId, passengerId, type: outputType, status: "VERIFIED", fileUrl, deliveredAt: new Date() },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: created.id,
      action: "OUTPUT_DELIVERED",
      byUserId: actor.userId,
      note: `${label} ${input.verb ?? "delivered"} to the customer (${actor.label})`,
    });
    if (PER_PASSENGER_OUTPUTS.has(outputType)) {
      if (outputType === "VISA_PDF" && passengerId) {
        await tx.bookingPassenger.updateMany({ where: { bookingId: booking.id, passengerId, outcome: null }, data: { outcome: "APPROVED", outcomeAt: new Date(), outcomeNote: "Visa delivered" } });
      }
      const travellers = await tx.bookingPassenger.findMany({ where: { bookingId: booking.id }, select: { passengerId: true, outcome: true } });
      const delivered = await tx.document.findMany({ where: { bookingId: booking.id, type: outputType }, select: { passengerId: true } });
      const coversAll = delivered.some((row) => row.passengerId === null);
      const deliveredIds = new Set(delivered.map((row) => row.passengerId));
      const active = travellers.filter((row) => row.outcome !== "REJECTED" && row.outcome !== "CANCELLED");
      allCovered = coversAll || active.every((row) => deliveredIds.has(row.passengerId));
      someNotApproved = travellers.some((row) => row.outcome === "REJECTED" || row.outcome === "CANCELLED");
    }
    const event = allCovered ? (outputType === "VISA_PDF" && someNotApproved ? "PARTIAL_APPROVED" : OUTPUT_DELIVERY_EVENT[outputType]) : outputType === "VISA_PDF" ? "PARTIAL_APPROVED" : null;
    statusNotification = event
      ? await applySystemEvent(tx, { scope: "BOOKING", entityId: booking.id, event, userId: actor.userId, actorLabel: actor.label })
      : null;
    return created;
  });

  const statusMessages = await dispatchStatusNotifications([statusNotification]);
  if (await usesStatusTemplates(booking.lead.serviceType)) {
    // The status didn't move (another passenger's visa / ticket): send this delivery with the status's own template.
    if (statusMessages === 0) {
      const template =
        outputType === "VISA_PDF"
          ? await statusTemplateFor(booking.lead.serviceType, "BOOKING", allCovered && !someNotApproved ? "DELIVERED_VISA_PDF" : "PARTIAL_APPROVED")
          : await statusTemplateFor(booking.lead.serviceType, "BOOKING", OUTPUT_DELIVERY_EVENT[outputType]);
      if (template) await sendStatusTemplate({ event: template.event, scope: "BOOKING", entityId: booking.id, statusLabel: template.label });
      else await notifyLegacyOutput(booking, outputType, fileUrl, document.id);
    }
  } else {
    await notifyLegacyOutput(booking, outputType, fileUrl, document.id);
  }

  // P15 — a delivered Special Fare ticket triggers the Return Ticket / OTB offer (once per journey).
  if (outputType === "TICKET_PDF") {
    await offerPostTicketCrossSell({ bookingId: booking.id, leadId: booking.leadId, serviceType: booking.lead.serviceType });
  }

  // Client doc 2026-10-15 (J4) — read the delivered ticket / visa (PNR, flight and visa details) and check
  // its name / passport against the passenger, in the background.
  if (/ticket|visa/i.test(outputType)) void runOcrForDocument(document.id);
  return document;
}

/** Outputs issued one per passenger (client doc 2026-10-20, A8 / B5). */
const PER_PASSENGER_OUTPUTS = new Set<OutputType>(["VISA_PDF", "TICKET_PDF", "RESERVATION_PDF"]);

/** The generic "your document is ready" message, for services not on the client's status templates. */
async function notifyLegacyOutput(booking: Booking & { lead: Lead; customer: Customer }, outputType: OutputType, fileUrl: string, documentId: string): Promise<void> {
  const label = OUTPUT_TYPE_LABELS[outputType];
  const downloadLink = booking.customerToken ? `${siteConfig.url}${fileUrl}?token=${booking.customerToken}` : `${siteConfig.url}/account`;
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.OUTPUT_DELIVERED,
    emailTo: booking.customer.email,
    whatsappTo: toWhatsAppId(booking.customer.mobile),
    smsTo: toWhatsAppId(booking.customer.mobile),
    variables: {
      customerName: booking.customer.name,
      leadReference: leadReference(booking.lead),
      documentName: label,
      downloadLink,
      // Client doc 2026-10-14 — the output's own "important information" text in the email, and a ticket's PNR / passengers / flights / baggage.
      outputType,
      ticketDetails: await ticketDetailsFor(booking.id, outputType),
    },
    auditTarget: { entityType: "Document", entityId: documentId },
  });
}
