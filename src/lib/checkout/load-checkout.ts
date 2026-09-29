import { db } from "../db";
import { isMockGatewayActive } from "../payments/get-gateway";
import { assertQuotationPayable } from "../payments/quotation-payable";
import { leadReference } from "../leads/reference";
import { resolveCheckoutDocumentTypes } from "./required-documents";
import { getEffectiveTerms, resolveLeadCountryId } from "../terms/service-terms";
import { findReusableDocuments } from "./reusable-documents";
import { showPostTicketOffer } from "../cross-sell/post-ticket";

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
  const reusable =
    paid && (booking.lead.serviceType === "NEW_VISA" || booking.lead.serviceType === "FLIGHT_SPECIAL_FARE")
      ? await findReusableDocuments({
          bookingId: booking.id,
          passengerIds: booking.passengers.map((row) => row.passenger.id),
          documentTypes,
          uploaded: booking.documents.filter((doc) => doc.passengerId).map((doc) => ({ passengerId: doc.passengerId as string, type: doc.type })),
        })
      : [];
  const quotationExpired = payment?.status === "PENDING" ? (await assertQuotationPayable({ purpose: payment.purpose, booking })) !== null : false;
  // P09 — the customer must agree to the service's Terms before any payment
  // option (gateway link or demo button) is offered.
  const termsAccepted = Boolean(booking.termsAcceptedAt);
  const terms = termsAccepted ? null : await getEffectiveTerms(booking.lead.serviceType, await resolveLeadCountryId(booking.lead.details));

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
