import { db } from "../db";
import { createLeadFromSubmission, notifyLeadReceived, type CreateLeadResult } from "../leads/create-lead";
import { createAutoCheckout } from "../checkout/create-auto-checkout";
import { describeError } from "../api/describe-error";

export type CreateReturnTicketResult =
  | { ok: true; lead: CreateLeadResult; payToken?: string; bookingId?: string }
  | { ok: false; fieldErrors: Record<string, string[]>; message: string };

/**
 * The Return Verified Ticket request pipeline, shared by the website route
 * and the OTB combined order (P18): the destination and its rate come from
 * Admin configuration (ReturnTicketDestination) — validated here, never
 * trusted from the client — then the Lead is created and, when priced, the
 * payment right away. A checkout failure never loses the Lead (staff can
 * still send a payment link from the CRM).
 */
export async function createReturnTicketRequest(input: {
  contact: { fullName: string; mobile: string; email: string };
  applicants: { fullName: string; passportNumber: string }[];
  destinationCountryId: string;
  travelDate: string;
  expectedReturnDate: string;
  source?: string;
  extraDetails?: Record<string, unknown>;
}): Promise<CreateReturnTicketResult> {
  const destination = await db.returnTicketDestination.findFirst({
    where: { countryId: input.destinationCountryId, active: true, country: { active: true } },
    include: { country: { select: { name: true } } },
  });
  if (!destination) {
    return { ok: false, message: "That destination isn't available right now.", fieldErrors: { destinationCountryId: ["Select an available destination."] } };
  }

  const ratePerApplicant = Number(destination.ratePerApplicant);
  const lead = await createLeadFromSubmission({
    // Client testing 2026-10-09 — pays straight away: the payment link is the customer's message.
    deferLeadReceivedNotice: true,
    serviceType: "RETURN_TICKET",
    source: input.source,
    contact: input.contact,
    passengers: input.applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
    details: {
      destinationCountry: destination.country.name,
      destinationCountryId: input.destinationCountryId,
      travelDate: input.travelDate,
      // Client update (2026-09-24): the customer's own target date — the
      // actual issued ticket date is a separate, staff/availability-
      // determined outcome, never computed here.
      expectedReturnDate: input.expectedReturnDate,
      travelers: String(input.applicants.length),
      ratePerApplicant,
      indicativeTotal: ratePerApplicant * input.applicants.length,
      applicants: input.applicants,
      ...input.extraDetails,
    },
  });

  let payToken: string | undefined;
  let bookingId: string | undefined;
  try {
    const checkout = await createAutoCheckout({
      leadId: lead.leadId,
      serviceType: "RETURN_TICKET",
      totalPrice: ratePerApplicant * input.applicants.length,
      invoiceLines: [
        {
          description: `Return Verified Ticket — ${destination.country.name}`,
          quantity: input.applicants.length,
          governmentFee: Math.min(Number(destination.airlineFeePerApplicant), ratePerApplicant),
          serviceFee: Math.max(0, ratePerApplicant - Number(destination.airlineFeePerApplicant)),
        },
      ],
    });
    payToken = checkout?.token;
    bookingId = checkout?.bookingId;
  } catch (checkoutError) {
    console.error("[return-ticket] auto checkout failed", describeError(checkoutError));
  }
  if (!payToken) await notifyLeadReceived(lead.leadId);
  return { ok: true, lead, payToken, bookingId };
}
