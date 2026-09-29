import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { buildApplicantRows } from "@/lib/new-visa/applicants";
import { syncExpiredReservations } from "@/lib/bookings/reservation";
import { evaluateRefundRule, documentsValidated, packageGenerated } from "@/lib/refunds/rules";
import { linkedOtbState, returnTicketCancellationFee } from "@/lib/return-ticket/operations";
import { expectedOtbCompletion } from "@/lib/otb/staff-actions";
import { canIssueReservation } from "@/lib/bookings/reservation";
import { getRefundConfig } from "@/lib/refunds/config";
import { passengerVisaStatus } from "@/lib/protection-plan/passenger-status";
import { leadOperationalBlock, parseOperationalBlock } from "@/lib/visa-change/operational";
import { getBookingTimeline } from "@/lib/audit/booking-timeline";
import { getBookingDates } from "@/lib/crm/booking-dates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      payments: { include: { refunds: true }, orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      lead: { include: { quotations: { where: { isSelected: true } } } },
      customer: { include: { passengers: true } },
      // CRM.md §12 (Step 14) — this booking's own passengers, each with an
      // independently visible status, distinct from customer.passengers
      // below (that stays the full Customer-360 history across every
      // lead/booking, same split LeadDetail.tsx already uses).
      passengers: { include: { passenger: true }, orderBy: { createdAt: "asc" } },
      // Step 20 (audit §7.1) — same flat-array-filtered-by-passengerId
      // convention as `documents` below, not duplicated onto each passenger.
      protectionPlans: { orderBy: { createdAt: "asc" } },
      serviceStatus: { select: { id: true, name: true, customerLabel: true, blocksRefund: true } },
      // P13 — Visa Extension <-> the New Visa booking it extends, visible from both sides.
      originalBooking: { select: { id: true, bookingId: true, status: true } },
      extensions: { select: { id: true, bookingId: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(auth.session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  // Return_Verified_Ticket.md §7: "Staff should be able to see the internal
  // expiry information" — synced here (not just wherever a future issue
  // action might live) per feedback_audit_all_readers_of_lazily_synced_state.
  const [synced] = await syncExpiredReservations([booking]);

  // Step 15 (audit §7.4): computed once per SUCCESS payment (only those can
  // ever be refunded) and attached so the refund calculator UI can surface
  // "which rule applied and why" *before* staff even opens the form, not
  // just as an error after they submit.
  const docsValidated = documentsValidated(booking.documents);
  const refundConfig = await getRefundConfig(booking.lead.serviceType);
  const isReturnTicket = booking.lead.serviceType === "RETURN_TICKET";
  const cancellationFee = isReturnTicket ? await returnTicketCancellationFee(booking.lead.details) : null;
  // P17 — the OTB <-> Return Ticket link (CRM.md §15), loaded separately to keep the main query small.
  const linkedBooking = booking.linkedBookingId
    ? await db.booking.findUnique({
        where: { id: booking.linkedBookingId },
        select: { id: true, bookingId: true, lead: { select: { serviceType: true } }, serviceStatus: { select: { name: true } } },
      })
    : null;
  // P21 — vendor summary + full timeline, each its own small query run in
  // parallel after the main one (never more nested includes above — that
  // query is already heavy enough to strain the local dev database).
  const selectedQuotation = booking.lead.quotations[0] ?? null;
  const [selectedVendor, timeline] = await Promise.all([
    selectedQuotation ? db.vendor.findUnique({ where: { id: selectedQuotation.vendorId }, select: { id: true, name: true } }) : Promise.resolve(null),
    getBookingTimeline(booking),
  ]);
  const paymentsWithRule = booking.payments.map((payment) => ({
    ...payment,
    refundRule:
      payment.status === "SUCCESS"
        ? evaluateRefundRule({
            serviceType: booking.lead.serviceType,
            bookingStatus: synced.status,
            blocksRefund: booking.serviceStatus?.blocksRefund ?? null,
            documentsValidated: docsValidated,
            packageGenerated: packageGenerated(booking.documents),
            extensionOutcome: synced.extensionOutcome,
            paymentSucceededAt: payment.updatedAt,
            cancellationFee,
          }, refundConfig)
        : null,
  }));

  return jsonSuccess({
    id: synced.id,
    bookingId: synced.bookingId,
    customerToken: synced.customerToken,
    status: synced.status,
    extensionOutcome: synced.extensionOutcome,
    createdAt: synced.createdAt,
    reservationIssuedAt: synced.reservationIssuedAt,
    reservationExpiresAt: synced.reservationExpiresAt,
    reservationExpired: synced.reservationExpired,
    // P11 — Booking Date (createdAt above), Applied to Embassy Date and Travel Date, each shown separately.
    appliedToEmbassyAt: booking.appliedToEmbassyAt,
    visaRejectionReason: booking.visaRejectionReason,
    travelDate: typeof (booking.lead.details as Record<string, unknown> | null)?.travelDate === "string" ? ((booking.lead.details as Record<string, unknown>).travelDate as string) : null,
    serviceStatusName: booking.serviceStatus?.name ?? null,
    // P21 — CRM.md §12: every service's own labelled dates for the booking header.
    bookingDates: getBookingDates({
      serviceType: booking.lead.serviceType,
      details: booking.lead.details,
      bookingCreatedAt: synced.createdAt,
      appliedToEmbassyAt: booking.appliedToEmbassyAt,
    }),
    // P21 — staff-internal vendor summary (vendor cost / margin never go to a customer view).
    vendorSummary: selectedQuotation
      ? {
          vendorId: selectedQuotation.vendorId,
          vendorName: selectedVendor?.name ?? null,
          vendorCost: selectedQuotation.vendorCost.toString(),
          margin: selectedQuotation.margin.toString(),
          sellingPrice: selectedQuotation.sellingPrice.toString(),
          quotationVendorReference: selectedQuotation.vendorReference,
          vendorReference: booking.pnrVendorReference,
          pnr: booking.pnr,
        }
      : null,
    // P21 — CRM.md §36: booking + lead + quotations + payments/refunds + documents, oldest first, capped.
    timeline: timeline.entries,
    timelineTruncated: timeline.truncated,
    originalBooking: booking.originalBooking,
    // P16 — Special Fare post-payment facts for the staff actions panel.
    specialFare:
      booking.lead.serviceType === "FLIGHT_SPECIAL_FARE"
        ? {
            finalConfirmedAt: booking.finalConfirmedAt,
            alternativeOffer: booking.alternativeOffer,
            pnr: booking.pnr,
            pnrVendorReference: booking.pnrVendorReference,
            pnrRecordedAt: booking.pnrRecordedAt,
            ticketIssuedAt: booking.ticketIssuedAt,
            ticketBaggage: booking.ticketBaggage,
            tickets: booking.passengers.map((row) => ({ passengerId: row.passenger.id, fullName: row.passenger.fullName, ticketNumber: row.ticketNumber })),
          }
        : null,
    // P18 — OTB airline timeline for the staff actions panel.
    otb:
      booking.lead.serviceType === "OTB"
        ? {
            otbReference: booking.pnr,
            submittedAt: booking.otbSubmittedAt,
            decidedAt: booking.otbDecidedAt,
            outcomeNote: booking.otbOutcomeNote,
            expectedBy: await expectedOtbCompletion({
              details: booking.lead.details,
              paidAt: booking.payments.filter((p) => p.status === "SUCCESS").reduce<Date | null>((min, p) => (!min || p.updatedAt < min ? p.updatedAt : min), null),
            }),
          }
        : null,
    // P17 — OTB <-> Return Ticket link, visible from both bookings.
    linkedBooking: linkedBooking
      ? { id: linkedBooking.id, bookingId: linkedBooking.bookingId, serviceType: linkedBooking.lead.serviceType, statusName: linkedBooking.serviceStatus?.name ?? null }
      : null,
    // P17 — Return Verified Ticket reservation, vendor and cancellation facts for the staff panel.
    returnTicket: isReturnTicket
      ? await (async () => {
          const travelDateRaw = (booking.lead.details as Record<string, unknown> | null)?.travelDate;
          const travelDate = typeof travelDateRaw === "string" ? new Date(travelDateRaw) : null;
          const otb = await linkedOtbState(booking.id);
          const quotation = selectedQuotation;
          const vendor = selectedVendor;
          const delivered = booking.documents.find((document) => document.type === "RESERVATION_PDF" && document.deliveredAt);
          return {
            cancellationFee,
            withinIssueWindow: travelDate && !Number.isNaN(travelDate.getTime()) ? canIssueReservation(travelDate) : false,
            otbApprovalPending: !otb.issuanceAllowed,
            vendor,
            vendorCost: quotation ? Number(quotation.vendorCost) : null,
            vendorReference: booking.pnrVendorReference,
            pnr: booking.pnr,
            deliveredAt: delivered?.deliveredAt ?? null,
          };
        })()
      : null,
    // P14 — Visa Change package / exit facts for the staff actions panel.
    visaChange:
      booking.lead.serviceType === "VISA_CHANGE"
        ? (() => {
            const details = (booking.lead.details ?? {}) as Record<string, unknown>;
            const block = parseOperationalBlock(booking.lead.quotations[0]?.operationalBlock) ?? leadOperationalBlock(details);
            return {
              changeType: details.changeType === "AIRPORT_TO_AIRPORT" || details.changeType === "BORDER_EXIT" ? details.changeType : null,
              packageGenerated: packageGenerated(booking.documents),
              defaultExitLocation: block ? (block.kind === "A2A" ? block.exitAirport : block.borderName) : null,
              exitCompletedAt: booking.exitCompletedAt,
              exitDetails: booking.exitDetails,
            };
          })()
        : null,
    extensions: booking.extensions,
    applicants: buildApplicantRows(booking.lead.details, booking.passengers.map((row) => row.passenger)),
    leadId: booking.leadId,
    leadReferenceId: leadReference(booking.lead),
    serviceType: booking.lead.serviceType,
    selectedQuotation,
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      mobile: booking.customer.mobile,
      email: booking.customer.email,
      passengers: booking.customer.passengers.map((passenger) => ({
        id: passenger.id,
        fullName: passenger.fullName,
        paxType: passenger.paxType,
      })),
    },
    // Documents aren't duplicated onto each passenger here — the client
    // derives "this passenger's documents" by filtering the flat
    // `documents` array below by `passengerId`, so there's exactly one
    // place a document's status ever lives, not two copies to keep in sync.
    passengers: booking.passengers.map((bookingPassenger) => ({
      id: bookingPassenger.passenger.id,
      fullName: bookingPassenger.passenger.fullName,
      paxType: bookingPassenger.passenger.paxType,
      status: bookingPassenger.status,
    })),
    payments: paymentsWithRule,
    documents: booking.documents,
    protectionPlans: booking.protectionPlans,
    // P12 — New Visa: each passenger's visa status next to their Protection Plan status.
    passengerStatuses:
      booking.lead.serviceType === "NEW_VISA"
        ? booking.passengers.map(({ passenger }) => ({
            passengerId: passenger.id,
            fullName: passenger.fullName,
            visaStatus: passengerVisaStatus({
              passengerId: passenger.id,
              visaRejected: Boolean(booking.visaRejectionReason),
              bookingStatusLabel: booking.serviceStatus?.name ?? synced.status,
              documents: booking.documents,
            }),
            protectionPlanStatus: booking.protectionPlans.find((plan) => plan.passengerId === passenger.id)?.status ?? null,
          }))
        : [],
    // Step 23 (audit §7.6) — null for any booking created before this field
    // existed; the UI simply omits the checklist section in that case.
    documentChecklistSnapshot: synced.documentChecklistSnapshot,
  });
}
