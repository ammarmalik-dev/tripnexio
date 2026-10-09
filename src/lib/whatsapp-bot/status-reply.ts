import { db } from "../db";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { leadReference } from "../leads/reference";
import { customerStatusLabel } from "../service-status/customer-label";

const MAX_ITEMS = 5;

/**
 * Client testing 2026-10-09 (C5) — "Track my request" answered inside the
 * chat: the requests of the customer whose WhatsApp number this is (their
 * WhatsApp number is the proof of identity, like the "last 4 digits" check on
 * /track), newest first, with the customer-facing status only — never an
 * internal status. Abandoned-form drafts are left out.
 */
export async function whatsappStatusReply(waId: string): Promise<string> {
  const lastTen = waId.replace(/\D/g, "").slice(-10);
  const customer = lastTen.length === 10 ? await db.customer.findFirst({ where: { mobile: { contains: lastTen } }, select: { id: true } }) : null;
  const leads = customer
    ? await db.lead.findMany({
        where: { customerId: customer.id, status: { notIn: ["LOST", "CLOSED"] } },
        orderBy: { createdAt: "desc" },
        take: MAX_ITEMS * 3,
        include: {
          serviceStatus: { select: { customerLabel: true } },
          bookings: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { bookingId: true, status: true, serviceStatus: { select: { customerLabel: true } } },
          },
        },
      })
    : [];
  const open = leads.filter((lead) => (lead.details as Record<string, unknown> | null)?.abandonedDraft !== true).slice(0, MAX_ITEMS);
  if (open.length === 0) {
    return `We couldn't find an open request for this WhatsApp number.\n\nType "menu" to start a new request, or "agent" to talk to our team.`;
  }
  const lines = open.map((lead) => {
    const booking = lead.bookings[0];
    const confirmed = booking && booking.status !== "PENDING";
    const status = confirmed
      ? customerStatusLabel("BOOKING", booking.serviceStatus, booking.status)
      : booking
        ? "Payment pending — use the payment link we sent you"
        : customerStatusLabel("LEAD", lead.serviceStatus, lead.status);
    return `• *${confirmed ? booking.bookingId : leadReference(lead)}* — ${SERVICE_TYPE_LABELS[lead.serviceType]}: ${status}`;
  });
  return `Here's the latest on your requests:\n\n${lines.join("\n")}\n\nType "agent" to talk to our team about any of them, or "menu" to start a new request.`;
}
