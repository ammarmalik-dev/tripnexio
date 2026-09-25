import { db } from "../db";
import { formatLeadReference } from "../leads/reference";
import {
  SERVICE_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REFUND_STATUS_LABELS,
} from "../crm/labels";

function money(value: unknown): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

/**
 * Step 56, CRM.md §25 — "AI drafts must use record data [and] avoid
 * inventing missing information." This is the one place that decides what
 * "record data" means for a Lead: a plain-text block built ONLY from
 * fields that actually exist. A field with no value is simply omitted from
 * the text (never written as "N/A" or similar) — the AI provider's system
 * prompt is told explicitly that anything not mentioned here should be
 * flagged as missing in the draft, not guessed.
 */
export async function buildLeadRecordContext(leadId: string): Promise<string | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: { include: { passengers: { include: { documents: true } } } },
      quotations: { orderBy: { createdAt: "desc" }, take: 1 },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { payments: { orderBy: { createdAt: "desc" }, include: { refunds: { orderBy: { createdAt: "desc" }, take: 1 } } } },
      },
    },
  });
  if (!lead) return null;

  const lines: string[] = [];
  lines.push(`Customer name: ${lead.customer.name}`);
  lines.push(`Service: ${SERVICE_TYPE_LABELS[lead.serviceType]}`);
  lines.push(`Lead reference: ${formatLeadReference(lead.serviceType, lead.id)}`);
  lines.push(`Lead status: ${LEAD_STATUS_LABELS[lead.status]}`);

  const details = (lead.details ?? {}) as Record<string, unknown>;
  if (typeof details.travelDate === "string") lines.push(`Travel date: ${details.travelDate}`);
  if (typeof details.visaExpiryDate === "string") lines.push(`Visa expiry date: ${details.visaExpiryDate}`);

  const quotation = lead.quotations[0];
  if (quotation) {
    lines.push(
      `Latest quotation: Total ${money(quotation.sellingPrice)}${quotation.isSelected ? " (selected)" : ""}${quotation.validityExpiresAt ? `, valid until ${quotation.validityExpiresAt.toLocaleDateString("en-IN")}` : ""}`
    );
  }

  const booking = lead.bookings[0];
  if (booking) {
    lines.push(`Latest booking: ${booking.bookingId} — ${BOOKING_STATUS_LABELS[booking.status]}`);
    const payment = booking.payments[0];
    if (payment) {
      lines.push(`Latest payment: ${money(payment.amount)} — ${PAYMENT_STATUS_LABELS[payment.status]}`);
      if (payment.status === "PENDING" && payment.paymentLink) {
        lines.push(`Payment link: ${payment.paymentLink}`);
      }
      const refund = payment.refunds[0];
      if (refund) {
        lines.push(`Latest refund: ${money(refund.refundAmount)} — ${REFUND_STATUS_LABELS[refund.status]}`);
      }
    }
  }

  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];
  const leadPassengers = lead.customer.passengers.filter((passenger) => passengerIds.includes(passenger.id));
  const outstanding = leadPassengers.flatMap((passenger) =>
    passenger.documents.filter((document) => document.status === "REQUIRED" || document.status === "MISSING").map((document) => document.type)
  );
  if (outstanding.length > 0) {
    lines.push(`Outstanding documents still needed from the customer: ${outstanding.join(", ")}`);
  }

  return lines.join("\n");
}
