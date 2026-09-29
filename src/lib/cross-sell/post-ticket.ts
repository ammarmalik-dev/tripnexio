import { db } from "../db";
import { createTask } from "../tasks/create-task";
import { leadReference } from "../leads/reference";

export const POST_TICKET_OFFER_TASK_TITLE = "Offer Return Ticket / OTB after ticket";

/** P15 — should this Special Fare booking show the post-ticket offer? Ticket delivered and the customer hasn't said "No thanks". */
export function showPostTicketOffer(input: { serviceType: string; crossSellOptOut: boolean; documentTypes: string[] }): boolean {
  return input.serviceType === "FLIGHT_SPECIAL_FARE" && !input.crossSellOptOut && input.documentTypes.includes("TICKET_PDF");
}

/**
 * P15 — Flight_Special_Fare.md §22/§29: once the ticket is delivered, offer
 * Return Verified Ticket and OTB (separate modules). The customer sees the
 * offer links on their payment page and account; staff get one follow-up
 * Task. Never repeated in the same journey (one task per lead) and skipped
 * when the customer opted out. Never throws.
 */
export async function offerPostTicketCrossSell(input: { bookingId: string; leadId: string; serviceType: string }): Promise<void> {
  if (input.serviceType !== "FLIGHT_SPECIAL_FARE") return;
  try {
    const lead = await db.lead.findUnique({ where: { id: input.leadId }, include: { customer: { select: { name: true } } } });
    if (!lead || lead.crossSellOptOut) return;
    const existing = await db.task.findFirst({ where: { leadId: lead.id, title: POST_TICKET_OFFER_TASK_TITLE }, select: { id: true } });
    if (existing) return;
    await db.$transaction((tx) =>
      createTask(tx, {
        type: "CROSS_SELL_FOLLOW_UP",
        title: POST_TICKET_OFFER_TASK_TITLE,
        reason: `${leadReference(lead)} — ${lead.customer.name}'s ticket was delivered. Offer a Return Verified Ticket and OTB where relevant (the customer also sees both offers on their payment page and account).`,
        entityType: "Lead",
        entityId: lead.id,
        leadId: lead.id,
        bookingId: input.bookingId,
        serviceType: lead.serviceType,
      })
    );
  } catch (error) {
    console.error("[cross-sell/post-ticket]", error);
  }
}
