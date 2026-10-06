import { db } from "../db";
import { isMockGatewayActive } from "../payments/get-gateway";
import { assertQuotationPayable } from "../payments/quotation-payable";
import { leadReference } from "../leads/reference";
import { resolveCheckoutDocumentTypes } from "./required-documents";
import { getEffectiveTerms, leadFlightScope, resolveLeadCountryId } from "../terms/service-terms";
import { findReusableDocuments } from "./reusable-documents";
import { showPostTicketOffer } from "../cross-sell/post-ticket";
import { customerAlternativeOffer, parseAlternativeOffer } from "../special-fare/post-payment";
import { returnTicketCancellationFee } from "../return-ticket/operations";

function linkedOrderView(
  linked: {
    customerToken: string | null;
    lead: { serviceType: string };
    payments: { status: string; amount: unknown; gstAmount: unknown; gatewayFee: unknown; couponDiscount: unknown }[];
  } | null
) {
  if (!linked?.customerToken || (linked.lead.serviceType !== "OTB" && linked.lead.serviceType !== "RETURN_TICKET")) return null;
  const payment = linked.payments[0] ?? null;
  const total = payment
    ? Math.max(0, Number(payment.amount) - Number(payment.couponDiscount ?? 0)) + Number(payment.gstAmount) + Number(payment.gatewayFee)
    : null;
  return {
    service: linked.lead.serviceType as "OTB" | "RETURN_TICKET",
    token: linked.customerToken,
    paymentStatus: payment?.status ?? null,
    total,
  };
}

/** Loads everything the guest /pay/<token> page needs, or null for an unknown token. Never exposes internal fields (vendor cost, margin, staff notes). */
export async function loadCheckoutByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;

  const booking = await db.booking.findUnique({
    where: { customerToken: token },
    include: {
      lead: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      passengers: { include: { passenger: { select: { id: true, fullName: true } } } },
      documents: { select: { id: true, passengerId: true, type: true, status: true, requestReason: true, rejectionReason: true } },
    },
  });
  if (!booking) return null;
  // P18 — the OTB <-> Return Verified Ticket order (customer-safe fields only), as its own small query.
  const linkedBooking = booking.linkedBookingId
    ? await db.booking.findUnique({
        where: { id: booking.linkedBookingId },
        select: {
          customerToken: true,
          lead: { select: { serviceType: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, amount: true, gstAmount: true, gatewayFee: true, couponDiscount: true } },
        },
      })
    : null;

  const payment = booking.payments[0] ?? null;
  const paid = payment?.status === "SUCCESS";
  const amount = payment ? Number(payment.amount) : 0;
  const gst = payment ? Number(payment.gstAmount) : 0;
  const gatewayFee = payment ? Number(payment.gatewayFee) : 0;
  const discount = Number(payment?.couponDiscount ?? 0);
  // P12 — the Protection Plan part of `amount`, shown as its own line.
  const protectionPlan = payment ? Number(payment.protectionPlanAmount) : 0;

  const documentTypes = paid ? await resolveCheckoutDocumentTypes(booking) : [];
  // P10/P15 — New Visa and Special Fare returning passengers: earlier uploads that could fill a slot (offered, never auto-used).
  // P18 — OTB: a recognised customer may reuse their stored passport and visa.
  const reusable =
    paid && (booking.lead.serviceType === "NEW_VISA" || booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" || booking.lead.serviceType === "OTB")
      ? await findReusableDocuments({
          bookingId: booking.id,
          passengerIds: booking.passengers.map((row) => row.passenger.id),
          documentTypes:
            booking.lead.serviceType === "OTB" ? documentTypes.filter((doc) => doc.type === "PASSPORT" || doc.type === "VISA_COPY") : documentTypes,
          uploaded: booking.documents.filter((doc) => doc.passengerId).map((doc) => ({ passengerId: doc.passengerId as string, type: doc.type })),
        })
      : [];
  const quotationExpired = payment?.status === "PENDING" ? (await assertQuotationPayable({ purpose: payment.purpose, booking })) !== null : false;
  // P09 — the customer must agree to the service's Terms before any payment
  // option (gateway link or demo button) is offered.
  const termsAccepted = Boolean(booking.termsAcceptedAt);
  const terms = termsAccepted
    ? null
    : await getEffectiveTerms(
        booking.lead.serviceType,
        await resolveLeadCountryId(booking.lead.details),
        await leadFlightScope({ id: booking.leadId, serviceType: booking.lead.serviceType })
      );

  return {
    booking,
    view: {
      serviceType: booking.lead.serviceType,
      leadReference: leadReference(booking.lead),
      /** Shown as the Booking ID once payment succeeded (the same value as the lead reference). */
      bookingId: paid ? booking.bookingId : null,
      payment: payment
        ? {
            status: payment.status,
            /** P16 — the reason shown for an extra payment (e.g. a Special Fare fare difference). */
            description: payment.purpose === "EXTRA" ? payment.description : null,
            amount: amount - protectionPlan,
            protectionPlan,
            gst,
            gatewayFee,
            discount,
            total: Math.max(0, amount - discount) + gst + gatewayFee,
            paymentLink: payment.status === "PENDING" && !quotationExpired && termsAccepted ? payment.paymentLink : null,
            linkExpiresAt: payment.linkExpiresAt,
          }
        : null,
      quotationExpired,
      termsAccepted,
      terms: terms ? { title: terms.title, body: terms.body, version: terms.version } : null,
      demoGateway: isMockGatewayActive(),
      applicants: booking.passengers.map((row) => ({ id: row.passenger.id, fullName: row.passenger.fullName })),
      documentTypes,
      reusable,
      // P11 — extra documents staff asked a passenger for, with the reason.
      requestedDocuments: booking.documents
        .filter((doc) => doc.passengerId && doc.requestReason)
        .map((doc) => ({ passengerId: doc.passengerId as string, type: doc.type, reason: doc.requestReason as string, status: doc.status })),
      /** P18 — the other half of an OTB + Return Verified Ticket order (its own payment page). */
      linkedOrder: linkedOrderView(linkedBooking),
      /** P17 — Return Ticket: the destination's cancellation fee, shown before payment (null = not set / other services). */
      returnTicketCancellation:
        booking.lead.serviceType === "RETURN_TICKET" ? { fee: await returnTicketCancellationFee(booking.lead.details) } : null,
      /** P16 — Special Fare alternative after the paid flight became unavailable (customer-safe; no vendor cost). */
      specialFareAlternative: booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" ? customerAlternativeOffer(parseAlternativeOffer(booking.alternativeOffer)) : null,
      /** P15 — Special Fare ticket delivered and not declined: offer Return Ticket / OTB. */
      postTicketOffer: showPostTicketOffer({
        serviceType: booking.lead.serviceType,
        crossSellOptOut: booking.lead.crossSellOptOut,
        documentTypes: booking.documents.map((document) => document.type),
      }),
      documents: booking.documents
        .filter((document) => document.passengerId)
        .map((document) => ({ passengerId: document.passengerId as string, type: document.type, status: document.status })),
    },
  };
}
