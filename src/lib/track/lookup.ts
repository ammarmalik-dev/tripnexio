import { db } from "../db";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import type { TrackResult, TrackStage, TrackStageStatus } from "./types";
import type { BookingStatus, LeadStatus, ServiceType } from "../../generated/prisma/enums";
import { HOLD_MARKER } from "../service-status/events";
import { OUTPUT_TYPES, OUTPUT_TYPE_LABELS, type OutputType } from "../outputs/output-types";
import { customerPassengerStatuses } from "../protection-plan/customer-passenger-statuses";

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

interface CurrentServiceStatus {
  id: string;
  customerLabel: string | null;
  displayOrder: number;
  systemEvent: string | null;
}

/**
 * P08 — the stages a booking's customer sees are its own service's
 * customer-facing labels (ServiceStatus.customerLabel, Admin-editable), in
 * status order: e.g. New Visa "Application Received → Documents Upload
 * Pending → … → Visa Approved". Negative endings (mapped to CANCELLED /
 * REFUNDED) are never listed — those show the closed message instead — and
 * the "Additional Documents …" detour only appears while the booking is on
 * it. Returns null (caller falls back to the generic 5 stages) when the
 * booking has no per-service status, is On Hold, or its service has no
 * customer labels configured.
 */
async function buildServiceStages(serviceType: ServiceType, current: CurrentServiceStatus | null): Promise<TrackStage[] | null> {
  if (!current || current.systemEvent === HOLD_MARKER) return null;
  const labelled = await db.serviceStatus.findMany({
    where: {
      serviceType,
      scope: "BOOKING",
      active: true,
      customerLabel: { not: null },
      NOT: [{ mapsToBookingStatus: "CANCELLED" }, { mapsToBookingStatus: "REFUNDED" }],
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, customerLabel: true, displayOrder: true },
  });
  if (labelled.length === 0) return null;

  // The customer-facing step the booking is on: its own label, else the last labelled step before it.
  const currentStep =
    labelled.find((status) => status.id === current.id) ??
    [...labelled].reverse().find((status) => status.displayOrder <= current.displayOrder) ??
    null;
  const currentLabel = currentStep?.customerLabel ?? null;

  const labels: string[] = [];
  for (const status of labelled) {
    const label = status.customerLabel as string;
    const detour = label.toLowerCase().startsWith("additional documents");
    if (detour && !(currentStep && status.displayOrder <= currentStep.displayOrder)) continue;
    if (!labels.includes(label)) labels.push(label);
  }

  const currentIndex = currentLabel ? labels.indexOf(currentLabel) : 0;
  return labels.map((label, index) => ({
    label,
    status: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

/** P09 — what's been delivered on a booking (labels and dates only; no file links on this public page). */
async function deliveredOutputs(bookingId: string | null | undefined) {
  if (!bookingId) return undefined;
  const documents = await db.document.findMany({
    where: { bookingId, type: { in: [...OUTPUT_TYPES] }, deliveredAt: { not: null } },
    orderBy: { deliveredAt: "asc" },
    select: { type: true, deliveredAt: true },
  });
  if (documents.length === 0) return undefined;
  return documents.map((document) => ({
    label: OUTPUT_TYPE_LABELS[document.type as OutputType],
    deliveredDate: formatDate(document.deliveredAt as Date),
  }));
}

/** P12 — per-passenger Visa / Protection Plan rows (masked names), only when a New Visa booking has any. */
async function passengerRows(bookingId: string) {
  const rows = await customerPassengerStatuses(bookingId, maskName);
  return rows.length > 0 ? rows : undefined;
}

function closedMessageFor(bookingStatus: BookingStatus | null, leadStatus: LeadStatus, visaRejectionReason?: string | null): string {
  // P11 — a New Visa the embassy rejected shows the reason staff recorded.
  if (visaRejectionReason) return `Your visa application was rejected. Reason: ${visaRejectionReason}`;
  if (bookingStatus === "CANCELLED") return "This booking has been cancelled.";
  if (bookingStatus === "REFUNDED") return "This booking was cancelled and refunded.";
  if (leadStatus === "LOST") return "This request is closed.";
  return "This request has been closed.";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** "Rahul Sharma" -> "Rahul S." — the only form of the name a public lookup returns. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** True when `verifier` is the last 4 digits of the customer's mobile, or their email (case-insensitive). */
function matchesVerifier(customer: { mobile: string; email: string | null }, verifier: string): boolean {
  const value = verifier.trim();
  if (/^\d{4}$/.test(value)) return customer.mobile.replace(/\D/g, "").endsWith(value);
  return Boolean(customer.email && customer.email.trim().toLowerCase() === value.toLowerCase());
}

/**
 * Public, unauthenticated lookup — Website_Final_Company_Support_Legal_General_FAQ
 * doc §5: "request only the minimum reference information needed... should not
 * publicly expose full passport numbers, payment credentials, or other
 * unnecessary sensitive information." Matches a stored Lead reference (e.g.
 * "10626VI001", or an older "OTB-JYOQHX") or a Booking.bookingId (the same
 * reference, or an older "TNX-OT-JYOQHX") exactly, and only
 * returns data when `verifier` matches the customer on file (last 4 mobile
 * digits or email). The name is returned masked. Any mismatch returns null,
 * indistinguishable from "not found".
 */
/** P18 — OTB.md §13: once approved, the customer sees the OTB PNR/reference. */
function approvedOtbReference(serviceType: string, booking: { pnr: string | null; serviceStatus: { systemEvent: string | null } | null }): string | undefined {
  return serviceType === "OTB" && booking.serviceStatus?.systemEvent === "OTB_APPROVED" && booking.pnr ? booking.pnr : undefined;
}

export async function trackByReferenceId(rawReferenceId: string, verifier: string): Promise<TrackResult | null> {
  const referenceId = rawReferenceId.trim().toUpperCase();

  const lead = await db.lead.findFirst({
    where: { reference: referenceId },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, mobile: true, email: true } },
      // P11 — the latest booking, whatever its state, so a rejected/cancelled
      // one shows its closed message instead of generic lead stages.
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { serviceStatus: { select: { id: true, customerLabel: true, displayOrder: true, systemEvent: true } } },
      },
    },
  });
  if (lead) {
    if (!matchesVerifier(lead.customer, verifier)) return null;
    const booking = lead.bookings[0] ?? null;
    const stageIndex = resolveStage(lead.status, booking?.status ?? null);
    const serviceStages = booking && stageIndex !== "closed" ? await buildServiceStages(lead.serviceType, booking.serviceStatus) : null;
    return {
      referenceId: lead.reference ?? referenceId,
      service: SERVICE_TYPE_LABELS[lead.serviceType],
      applicantName: maskName(lead.customer.name),
      submittedDate: formatDate(lead.createdAt),
      stages: stageIndex === "closed" ? [] : (serviceStages ?? buildStages(stageIndex)),
      delivered: await deliveredOutputs(booking?.id),
      passengers: booking ? await passengerRows(booking.id) : undefined,
      otbReference: booking ? approvedOtbReference(lead.serviceType, booking) : undefined,
      closedMessage: stageIndex === "closed" ? closedMessageFor(booking?.status ?? null, lead.status, booking?.visaRejectionReason) : undefined,
    };
  }

  const booking = await db.booking.findUnique({
    where: { bookingId: referenceId },
    include: {
      customer: { select: { name: true, mobile: true, email: true } },
      lead: { select: { serviceType: true, status: true } },
      serviceStatus: { select: { id: true, customerLabel: true, displayOrder: true, systemEvent: true } },
    },
  });
  if (booking) {
    if (!matchesVerifier(booking.customer, verifier)) return null;
    const stageIndex = resolveStage(booking.lead.status, booking.status);
    const serviceStages = stageIndex !== "closed" ? await buildServiceStages(booking.lead.serviceType, booking.serviceStatus) : null;
    return {
      referenceId: booking.bookingId,
      service: SERVICE_TYPE_LABELS[booking.lead.serviceType],
      applicantName: maskName(booking.customer.name),
      submittedDate: formatDate(booking.createdAt),
      stages: stageIndex === "closed" ? [] : (serviceStages ?? buildStages(stageIndex)),
      delivered: await deliveredOutputs(booking.id),
      passengers: await passengerRows(booking.id),
      otbReference: approvedOtbReference(booking.lead.serviceType, booking),
      closedMessage: stageIndex === "closed" ? closedMessageFor(booking.status, booking.lead.status, booking.visaRejectionReason) : undefined,
    };
  }

  return null;
}
