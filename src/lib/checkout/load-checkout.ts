import { db } from "../db";
import { getPaymentGateway } from "../payments/get-gateway";
import { formatLeadReference } from "../leads/reference";
import { getCheckoutDocumentTypes } from "./required-documents";

/** Loads everything the guest /pay/<token> page needs, or null for an unknown token. Never exposes internal fields (vendor cost, margin, staff notes). */
export async function loadCheckoutByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;

  const booking = await db.booking.findUnique({
    where: { customerToken: token },
    include: {
      lead: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      passengers: { include: { passenger: { select: { id: true, fullName: true } } } },
      documents: { select: { id: true, passengerId: true, type: true, status: true } },
    },
  });
  if (!booking) return null;

  const payment = booking.payments[0] ?? null;
  const paid = payment?.status === "SUCCESS";
  const amount = payment ? Number(payment.amount) : 0;
  const gst = payment ? Number(payment.gstAmount) : 0;
  const gatewayFee = payment ? Number(payment.gatewayFee) : 0;
  const discount = Number(payment?.couponDiscount ?? 0);

  return {
    booking,
    view: {
      serviceType: booking.lead.serviceType,
      leadReference: formatLeadReference(booking.lead.serviceType, booking.leadId),
      /** The real TNX-XX-XXXXXX id only exists once payment succeeded. */
      bookingId: paid ? booking.bookingId : null,
      payment: payment
        ? {
            status: payment.status,
            amount,
            gst,
            gatewayFee,
            discount,
            total: Math.max(0, amount - discount) + gst + gatewayFee,
            paymentLink: payment.status === "PENDING" ? payment.paymentLink : null,
            linkExpiresAt: payment.linkExpiresAt,
          }
        : null,
      demoGateway: getPaymentGateway().providerName === "mock",
      applicants: booking.passengers.map((row) => ({ id: row.passenger.id, fullName: row.passenger.fullName })),
      documentTypes: paid ? getCheckoutDocumentTypes(booking.lead.serviceType) : [],
      documents: booking.documents
        .filter((document) => document.passengerId)
        .map((document) => ({ passengerId: document.passengerId as string, type: document.type, status: document.status })),
    },
  };
}
