import { db } from "../db";
import { customerTicketFlow, parseTicketFlow } from "../special-fare/ticket-cancellation";
import { selectedFlightView } from "../special-fare/selected-flight";
import { isMockGatewayActive } from "../payments/get-gateway";
import { assertQuotationPayable } from "../payments/quotation-payable";
import { leadReference } from "../leads/reference";
import { resolveCheckoutDocumentTypes } from "./required-documents";
import { getEffectiveTerms, leadFlightScope, resolveLeadCountryId } from "../terms/service-terms";
import { findReusableDocuments } from "./reusable-documents";
import { showPostTicketOffer } from "../cross-sell/post-ticket";
import { customerAlternativeOffer, parseAlternativeOffer } from "../special-fare/post-payment";
import { returnTicketCancellationFee } from "../return-ticket/operations";
import { bookingDocumentsWhere } from "../documents/document-lead";
import { displayFeeSplit } from "../invoices/service-fee";
import { feeLabelFor } from "../invoices/invoice-document";
import { isDocumentUploaded, uploadedDocumentSlots } from "../documents/upload-state";
import { OFFLINE_PAYMENT_SERVICES } from "../payments/offline-payment";

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

  const found = await db.booking.findUnique({
    where: { customerToken: token },
    include: {
      lead: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      passengers: { include: { passenger: { select: { id: true, fullName: true } } } },
    },
  });
  if (!found) return null;
  // Client doc 2026-10-15 (I6) — what the customer already uploaded with the request counts here too.
  const booking = {
    ...found,
    documents: await db.document.findMany({
      where: { AND: [bookingDocumentsWhere(found), { purgedAt: null }] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, passengerId: true, type: true, status: true, fileUrl: true, requestReason: true, rejectionReason: true },
    }),
  };
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
  // Client doc 2026-10-27 (C5) — the price as Govt./Airline/Vendor fee + the configured service fee (GST on that only).
  const feeSplit = displayFeeSplit({
    amount,
    protectionPlan,
    invoiceServiceFee: payment?.invoiceServiceFee != null ? Number(payment.invoiceServiceFee) : null,
  });

  const resolvedTypes = paid ? await resolveCheckoutDocumentTypes(booking) : [];
  // Client doc 16 Nov (F10 / G10) — each document's Document Master description, shown under its name.
  const descriptions = resolvedTypes.length
    ? await db.documentType.findMany({ where: { name: { in: resolvedTypes.map((doc) => doc.type) } }, select: { name: true, description: true } })
    : [];
  const documentTypes = resolvedTypes.map((doc) => ({ ...doc, description: descriptions.find((row) => row.name === doc.type)?.description ?? null }));
  // P10/P15 — New Visa and Special Fare returning passengers: earlier uploads that could fill a slot (offered, never auto-used).
  // P18 — OTB: a recognised customer may reuse their stored passport and visa.
  const reusable =
    paid && (booking.lead.serviceType === "NEW_VISA" || booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" || booking.lead.serviceType === "OTB")
      ? await findReusableDocuments({
          bookingId: booking.id,
          passengerIds: booking.passengers.map((row) => row.passenger.id),
          documentTypes:
            booking.lead.serviceType === "OTB" ? documentTypes.filter((doc) => doc.type === "PASSPORT" || doc.type === "VISA_COPY") : documentTypes,
          // Client doc 2026-10-27 (C8) — a "Pending" slot row is not an upload, so it doesn't hide the "Use existing" offer.
          uploaded: uploadedDocumentSlots(booking.documents),
        })
      : [];
  // Client doc 16 Nov (H10 / M3) — "Track Refund" opens this page's refund section: customer-safe fields only
  // (amount, status, the gateway's own refund id) — never the staff reason or the internal charge split.
  const refunds = await db.refund.findMany({
    where: { payment: { bookingId: booking.id } },
    orderBy: { createdAt: "desc" },
    select: { refundAmount: true, status: true, gatewayRefundId: true, createdAt: true, completedAt: true },
  });
  const notPayableReason = payment?.status === "PENDING" ? await assertQuotationPayable({ purpose: payment.purpose, booking }) : null;
  // Client doc 16 Nov (I2) — the quotation services may pay by bank transfer: Admin's bank details (Invoice Settings).
  const offlineService = OFFLINE_PAYMENT_SERVICES.has(booking.lead.serviceType) && payment?.status === "PENDING" && payment.purpose !== "EXTRA";
  const bankConfig = offlineService
    ? await db.invoiceConfig.findUnique({ where: { id: "singleton" }, select: { bankAccountName: true, bankAccountNumber: true, bankIfscCode: true, bankName: true, bankBranch: true } })
    : null;
  const quotationExpired = notPayableReason !== null;
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
            serviceFee: payment.purpose === "EXTRA" ? null : feeSplit.serviceFee,
            passThroughFee: payment.purpose === "EXTRA" ? 0 : feeSplit.passThroughFee,
            feeLabel: feeLabelFor(booking.lead.serviceType),
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
      /** Client doc 16 Nov (I11) — the customer may enter a coupon here (New Visa / OTB / Return Ticket, online payment, none applied yet). */
      couponAllowed:
        (booking.lead.serviceType === "NEW_VISA" || booking.lead.serviceType === "OTB" || booking.lead.serviceType === "RETURN_TICKET") &&
        payment?.status === "PENDING" &&
        payment.method === "GATEWAY" &&
        payment.purpose !== "EXTRA" &&
        discount === 0,
      /** Client doc 16 Nov (I2) — pay the accepted quotation by bank transfer (null = not offered). */
      bankTransfer:
        offlineService && bankConfig?.bankAccountNumber
          ? {
              accountName: bankConfig.bankAccountName,
              accountNumber: bankConfig.bankAccountNumber,
              ifsc: bankConfig.bankIfscCode,
              bankName: bankConfig.bankName,
              branch: bankConfig.bankBranch,
              receiptUploaded: payment?.method === "BANK_TRANSFER" && Boolean(payment.bankSlipUrl),
            }
          : null,
      /** Why the payment can't be made (expired quotation, cancelled request), shown instead of the payment button. */
      notPayableReason,
      termsAccepted,
      terms: terms ? { title: terms.title, body: terms.body, version: terms.version, acceptanceText: terms.acceptanceText } : null,
      demoGateway: isMockGatewayActive(),
      // Client doc 16 Nov (H2) — documents are asked only from active passengers (not cancelled / rejected).
      applicants: booking.passengers
        .filter((row) => row.outcome !== "CANCELLED" && row.outcome !== "REJECTED")
        .map((row) => ({ id: row.passenger.id, fullName: row.passenger.fullName })),
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
      /** Client doc 16 Nov (A12 / A14) — a ticket cancellation quotation / airline reschedule waiting for the customer. */
      ticketFlow: booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" ? customerTicketFlow(parseTicketFlow(booking.ticketCancellation)) : null,
      /** Client doc 16 Nov (A10) — the selected flight (cities, flight no., dates, times, PAX) on the payment page. */
      selectedFlight: booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" ? await selectedFlightView(booking.leadId, booking.lead.paxCount) : null,
      /** P16 — Special Fare alternative after the paid flight became unavailable (customer-safe; no vendor cost). */
      specialFareAlternative: booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" ? customerAlternativeOffer(parseAlternativeOffer(booking.alternativeOffer)) : null,
      /** P15 — Special Fare ticket delivered and not declined: offer Return Ticket / OTB. */
      postTicketOffer: showPostTicketOffer({
        serviceType: booking.lead.serviceType,
        crossSellOptOut: booking.lead.crossSellOptOut,
        documentTypes: booking.documents.map((document) => document.type),
      }),
      // Client doc 2026-10-27 (C8 / E3) — only real files for this booking's passengers ("Pending" slots and rejected
      // files are not uploads; earlier bookings' files appear only as "Use existing" offers above).
      documents: booking.documents
        .filter((document) => document.passengerId && isDocumentUploaded(document))
        .map((document) => ({ passengerId: document.passengerId as string, type: document.type, status: document.status })),
      // Client doc 16 Nov (G10) — each slot's state: uploaded (under review, may be replaced), validated (locked) or
      // rejected (with the reason, upload again). The newest row per passenger + document wins.
      documentStates: booking.documents
        .filter((document) => document.passengerId && (document.status === "VERIFIED" || document.status === "REJECTED" || (document.status === "RECEIVED" && document.fileUrl)))
        .filter((document, index, all) => all.findIndex((other) => other.passengerId === document.passengerId && other.type === document.type) === index)
        .map((document) => ({
          passengerId: document.passengerId as string,
          type: document.type,
          status: document.status as "RECEIVED" | "VERIFIED" | "REJECTED",
          rejectionReason: document.status === "REJECTED" ? document.rejectionReason : null,
        })),
      refunds: refunds.map((refund) => ({
        amount: Number(refund.refundAmount),
        status: refund.status,
        reference: refund.gatewayRefundId,
        requestedAt: refund.createdAt.toISOString(),
        completedAt: refund.completedAt ? refund.completedAt.toISOString() : null,
      })),
    },
  };
}
