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
  PAYMENT_LINK_READY: "Complete Your Payment",
  REFUND_UPDATE: "Refund Update",
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

interface LeadInfo {
  serviceType: ServiceType;
  countryName: string | null;
}

const LEAD_INFO_SELECT = { serviceType: true, country: { select: { name: true } } } as const;

async function leadInfoFor(target: { entityType: string; entityId: string }): Promise<LeadInfo | null> {
  try {
    let lead: { serviceType: ServiceType; country: { name: string } | null } | null | undefined = null;
    switch (target.entityType) {
      case "Lead":
        lead = await db.lead.findUnique({ where: { id: target.entityId }, select: LEAD_INFO_SELECT });
        break;
      case "Booking":
        lead = (await db.booking.findUnique({ where: { id: target.entityId }, select: { lead: { select: LEAD_INFO_SELECT } } }))?.lead;
        break;
      case "Payment":
        lead = (await db.payment.findUnique({ where: { id: target.entityId }, select: { booking: { select: { lead: { select: LEAD_INFO_SELECT } } } } }))?.booking.lead;
        break;
      case "Quotation":
        lead = (await db.quotation.findUnique({ where: { id: target.entityId }, select: { lead: { select: LEAD_INFO_SELECT } } }))?.lead;
        break;
      case "Document":
        lead = (await db.document.findUnique({ where: { id: target.entityId }, select: { booking: { select: { lead: { select: LEAD_INFO_SELECT } } } } }))?.booking?.lead;
        break;
    }
    return lead ? { serviceType: lead.serviceType, countryName: lead.country?.name ?? null } : null;
  } catch {
    return null;
  }
}

/** Services whose Service line names the country ("New Visa – United Arab Emirates"), as on the invoice. */
const SERVICES_WITH_COUNTRY = new Set<ServiceType>(["NEW_VISA", "OTB", "RETURN_TICKET"]);

/**
 * Client testing 2026-10-09 (H7) — the picture per event: request received,
 * quote ready, payment, visa approved / visa delivered, and a boarding pass for
 * a delivered ticket / OTB approval. Everything else keeps the service picture.
 */
export function illustrationFor(event: string, serviceType: ServiceType | null, status: string | null): EmailIllustration {
  const isFlight = serviceType !== null && FLIGHT_SERVICES.has(serviceType);
  if (event === "LEAD_RECEIVED" || event === "ENQUIRY_RECEIVED") return "request";
  if (event === "QUOTE_READY" || event === "QUOTE_REMINDER" || event === "ABANDONED_QUOTE_COUPON") return "quote";
  if (event.startsWith("PAYMENT_")) return "payment";
  if (event === "OTB_APPROVED") return "boarding";
  if (event === "OUTPUT_DELIVERED" && serviceType !== null) return isFlight ? "boarding" : "approved";
  if (event === "SERVICE_STATUS_UPDATE" && status) {
    if (!isFlight && /approved/i.test(status)) return "approved";
    if (isFlight && /(issued|approved|confirmed)/i.test(status)) return "boarding";
  }
  return serviceType === null ? "general" : isFlight ? "flight" : "visa";
}

/**
 * The airline on a flight booking/quote email: the quotation's own airline
 * (a Quotation target), else the lead's selected — or latest sent — quote.
 */
async function airlineFor(target: { entityType: string; entityId: string }): Promise<{ name: string; logoUrl: string | null } | null> {
  try {
    let code: string | null = null;
    if (target.entityType === "Quotation") {
      code = (await db.quotation.findUnique({ where: { id: target.entityId }, select: { airline: true } }))?.airline ?? null;
    } else {
      const leadId =
        target.entityType === "Lead"
          ? target.entityId
          : target.entityType === "Booking"
            ? (await db.booking.findUnique({ where: { id: target.entityId }, select: { leadId: true } }))?.leadId
            : target.entityType === "Payment"
              ? (await db.payment.findUnique({ where: { id: target.entityId }, select: { booking: { select: { leadId: true } } } }))?.booking.leadId
              : target.entityType === "Document"
                ? (await db.document.findUnique({ where: { id: target.entityId }, select: { booking: { select: { leadId: true } } } }))?.booking?.leadId
                : null;
      if (leadId) {
        const quote = await db.quotation.findFirst({
          where: { leadId, isDraft: false, airline: { not: null } },
          orderBy: [{ isSelected: "desc" }, { updatedAt: "desc" }],
          select: { airline: true },
        });
        code = quote?.airline ?? null;
      }
    }
    if (!code) return null;
    const airline = await db.airline.findUnique({ where: { code }, select: { name: true, logoUrl: true } });
    return airline ? { name: airline.name, logoUrl: airline.logoUrl } : { name: code, logoUrl: null };
  } catch {
    return null;
  }
}

export async function emailHeroFor(event: string, target: { entityType: string; entityId: string }, variables: Record<string, string>): Promise<EmailHero | null> {
  const info = await leadInfoFor(target);
  const serviceType = info?.serviceType ?? null;
  const isFlight = serviceType !== null && FLIGHT_SERVICES.has(serviceType);
  const illustration = illustrationFor(event, serviceType, variables.status || null);
  const serviceLabel = serviceType ? SERVICE_TYPE_LABELS[serviceType] : null;
  const airline = isFlight ? await airlineFor(target) : null;
  // Client testing 2026-10-09 (H) — the Booking ID / Service card.
  const reference = variables.bookingId || variables.leadReference || null;
  const service = serviceLabel
    ? info?.countryName && serviceType && SERVICES_WITH_COUNTRY.has(serviceType)
      ? `${serviceLabel} – ${info.countryName}`
      : serviceLabel
    : variables.serviceType || null;
  const summary = reference || service ? { reference, service } : null;

  if (STATUS_EVENTS.has(event) || (!EVENT_HEADINGS[event] && serviceLabel)) {
    return {
      heading: serviceLabel ? `${serviceLabel} ${isFlight ? "Booking" : "Application"} Status` : "Status Update",
      badge: variables.status || (event === "OUTPUT_DELIVERED" ? variables.documentName || "Delivered" : null),
      illustration,
      airline,
      summary,
    };
  }
  const heading = EVENT_HEADINGS[event];
  return heading ? { heading, badge: event === "OTB_APPROVED" ? "Approved" : null, illustration, airline, summary } : null;
}
