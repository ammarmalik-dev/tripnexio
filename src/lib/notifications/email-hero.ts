import { db } from "../db";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import type { EmailHero, EmailIllustration } from "../email/layout";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client corrections 2026-10-05 — the illustration + heading + status pill on
 * a notification email. Flight services (Special Fare, Return Ticket, OTB)
 * get the flight picture, never the passport/visa one; visa services get the
 * passport/visa picture; payment emails the receipt.
 */
const FLIGHT_SERVICES = new Set<ServiceType>(["FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"]);

const EVENT_HEADINGS: Record<string, string> = {
  LEAD_RECEIVED: "Request Received",
  QUOTE_READY: "Your Quote Is Ready",
  QUOTE_REMINDER: "Your Quote Is Waiting",
  QUOTE_EXPIRED: "Quote Expired",
  PAYMENT_RECEIVED: "Payment Received",
  PAYMENT_REMINDER: "Payment Pending",
  DOCUMENTS_REQUIRED: "Documents Required",
  DOCUMENT_APPROVED: "Document Approved",
  DOCUMENT_REJECTED: "Document Needs Attention",
  VISA_EXTENSION_REMINDER: "Visa Extension Reminder",
  OTB_APPROVED: "OTB Approved",
  ABANDONED_QUOTE_COUPON: "A Special Offer on Your Quote",
  ENQUIRY_RECEIVED: "We Received Your Message",
  COMPLAINT_RECEIVED: "Complaint Registered",
};

/** Events whose heading is "<Service> Application/Booking Status" with the status in the pill. */
const STATUS_EVENTS = new Set(["SERVICE_STATUS_UPDATE", "OUTPUT_DELIVERED"]);

async function serviceTypeFor(target: { entityType: string; entityId: string }): Promise<ServiceType | null> {
  try {
    switch (target.entityType) {
      case "Lead":
        return (await db.lead.findUnique({ where: { id: target.entityId }, select: { serviceType: true } }))?.serviceType ?? null;
      case "Booking":
        return (await db.booking.findUnique({ where: { id: target.entityId }, select: { lead: { select: { serviceType: true } } } }))?.lead.serviceType ?? null;
      case "Payment":
        return (await db.payment.findUnique({ where: { id: target.entityId }, select: { booking: { select: { lead: { select: { serviceType: true } } } } } }))?.booking.lead.serviceType ?? null;
      case "Quotation":
        return (await db.quotation.findUnique({ where: { id: target.entityId }, select: { lead: { select: { serviceType: true } } } }))?.lead.serviceType ?? null;
      case "Document":
        return (await db.document.findUnique({ where: { id: target.entityId }, select: { booking: { select: { lead: { select: { serviceType: true } } } } } }))?.booking?.lead.serviceType ?? null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function emailHeroFor(event: string, target: { entityType: string; entityId: string }, variables: Record<string, string>): Promise<EmailHero | null> {
  const serviceType = await serviceTypeFor(target);
  const isFlight = serviceType !== null && FLIGHT_SERVICES.has(serviceType);
  const illustration: EmailIllustration = event.startsWith("PAYMENT_")
    ? "payment"
    : serviceType === null
      ? "general"
      : isFlight
        ? "flight"
        : "visa";
  const serviceLabel = serviceType ? SERVICE_TYPE_LABELS[serviceType] : null;

  if (STATUS_EVENTS.has(event) || (!EVENT_HEADINGS[event] && serviceLabel)) {
    return {
      heading: serviceLabel ? `${serviceLabel} ${isFlight ? "Booking" : "Application"} Status` : "Status Update",
      badge: variables.status || (event === "OUTPUT_DELIVERED" ? variables.documentName || "Delivered" : null),
      illustration,
    };
  }
  const heading = EVENT_HEADINGS[event];
  return heading ? { heading, badge: event === "OTB_APPROVED" ? "Approved" : null, illustration } : null;
}
