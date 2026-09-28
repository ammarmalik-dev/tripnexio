import { db } from "../db";
import { parseLeadReference, formatLeadReference } from "../leads/reference";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import type { TrackResult, TrackStage, TrackStageStatus } from "./types";
import type { BookingStatus, LeadStatus } from "../../generated/prisma/enums";

/**
 * The 5 locked customer-facing stages — Homepage_FINAL_Locked_1of1.docx §6:
 * "Application Received → Documents Validated → Submitted for Processing →
 * Under Review → Completed." Same sequence the homepage's own
 * `TrackJourneyPreview` sample card already shows, so a real lookup here
 * reads as a continuation of the same promise, not a different vocabulary.
 */
const STAGE_LABELS = ["Application Received", "Documents Validated", "Submitted for Processing", "Under Review", "Completed"] as const;

type StageIndex = 0 | 1 | 2 | 3 | 4;

/**
 * Judgment call: the locked 5-stage sequence is generic across every
 * service, but the real data model has two different granular status
 * enums (LeadStatus before a booking exists, BookingStatus after) with no
 * 1:1 mapping onto 5 fixed stages ever specified by any doc. This mapping
 * is a reasonable, documented interpretation, not a locked rule — revisit
 * if the client wants a specific status to land on a different stage.
 * LOST/CLOSED/CANCELLED/REFUNDED are terminal-negative states that don't
 * fit "which of the 5 stages are we on," so they're handled separately
 * (closedMessage) rather than forced into this scale.
 */
function resolveStage(leadStatus: LeadStatus, bookingStatus: BookingStatus | null): StageIndex | "closed" {
  if (bookingStatus) {
    switch (bookingStatus) {
      case "PENDING":
        return 2;
      case "CONFIRMED":
        return 3;
      case "PROCESSING":
        return 3;
      case "COMPLETED":
        return 4;
      case "CANCELLED":
      case "REFUNDED":
        return "closed";
    }
  }

  switch (leadStatus) {
    case "NEW":
      return 0;
    case "CONTACTED":
    case "FOLLOW_UP_REQUIRED":
    case "CUSTOMER_RESPONDED":
    case "QUALIFIED":
      return 1;
    case "QUOTATION_CREATED":
    case "QUOTATION_ACCEPTED":
    case "PAYMENT_PENDING":
      return 2;
    case "CONVERTED":
      // A converted lead should always have a booking by this point — this
      // is a defensive fallback, not the expected path.
      return 2;
    case "LOST":
    case "CLOSED":
      return "closed";
  }
}

function buildStages(stageIndex: StageIndex): TrackStage[] {
  return STAGE_LABELS.map((label, index) => {
    let status: TrackStageStatus;
    if (index < stageIndex) status = "done";
    else if (index === stageIndex) status = "current";
    else status = "upcoming";
    return { label, status };
  });
}

function closedMessageFor(bookingStatus: BookingStatus | null, leadStatus: LeadStatus): string {
  if (bookingStatus === "CANCELLED") return "This booking has been cancelled.";
  if (bookingStatus === "REFUNDED") return "This booking was cancelled and refunded.";
  if (leadStatus === "LOST") return "This request is closed.";
  return "This request has been closed.";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Public, unauthenticated lookup by reference ID — Website_Final_Company_
 * Support_Legal_General_FAQ doc §5: "request only the minimum reference
 * information needed... should not publicly expose full passport numbers,
 * payment credentials, or other unnecessary sensitive information." Tries
 * a Lead reference first (e.g. "OTB-058517"), then a Booking.bookingId
 * (e.g. "TNX-OT-058517") — a converted lead's booking is the more specific,
 * more up-to-date record when both would match the same underlying request.
 */
export async function trackByReferenceId(rawReferenceId: string): Promise<TrackResult | null> {
  const referenceId = rawReferenceId.trim();

  const parsed = parseLeadReference(referenceId);
  if (parsed) {
    const lead = await db.lead.findFirst({
      where: { serviceType: parsed.serviceType, id: { endsWith: parsed.suffix } },
      include: {
        customer: { select: { name: true } },
        bookings: { where: { status: { notIn: ["CANCELLED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (lead) {
      const booking = lead.bookings[0] ?? null;
      const stageIndex = resolveStage(lead.status, booking?.status ?? null);
      return {
        referenceId: formatLeadReference(lead.serviceType, lead.id),
        service: SERVICE_TYPE_LABELS[lead.serviceType],
        applicantName: lead.customer.name,
        submittedDate: formatDate(lead.createdAt),
        stages: stageIndex === "closed" ? [] : buildStages(stageIndex),
        closedMessage: stageIndex === "closed" ? closedMessageFor(booking?.status ?? null, lead.status) : undefined,
      };
    }
  }

  const booking = await db.booking.findUnique({
    where: { bookingId: referenceId.toUpperCase() },
    include: { customer: { select: { name: true } }, lead: { select: { serviceType: true, status: true } } },
  });
  if (booking) {
    const stageIndex = resolveStage(booking.lead.status, booking.status);
    return {
      referenceId: booking.bookingId,
      service: SERVICE_TYPE_LABELS[booking.lead.serviceType],
      applicantName: booking.customer.name,
      submittedDate: formatDate(booking.createdAt),
      stages: stageIndex === "closed" ? [] : buildStages(stageIndex),
      closedMessage: stageIndex === "closed" ? closedMessageFor(booking.status, booking.lead.status) : undefined,
    };
  }

  return null;
}
