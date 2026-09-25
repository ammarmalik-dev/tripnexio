import type { NextRequest } from "next/server";
import { returnTicketRequestSchema } from "@/lib/validation/return-ticket-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { db } from "@/lib/db";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = returnTicketRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const { fullName, mobile, email, passportNumber, destinationCountryId, travelDate, expectedReturnDate, additionalApplicants } =
    parsed.data;

  try {
    // The destination and its rate come from Admin configuration
    // (ReturnTicketDestination) — validated here, never trusted from the client.
    const destination = await db.returnTicketDestination.findFirst({
      where: { countryId: destinationCountryId, active: true, country: { active: true } },
      include: { country: { select: { name: true } } },
    });
    if (!destination) {
      return jsonError(400, "That destination isn't available right now.", {
        destinationCountryId: ["Select an available destination."],
      });
    }

    const applicants = [{ fullName, passportNumber }, ...additionalApplicants];
    const ratePerApplicant = Number(destination.ratePerApplicant);

    const result = await createLeadFromSubmission({
      serviceType: "RETURN_TICKET",
      contact: { fullName, mobile, email },
      passengers: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
      details: {
        destinationCountry: destination.country.name,
        destinationCountryId,
        travelDate,
        // Client update (2026-09-24): the customer's own target date — the
        // actual issued ticket date is a separate, staff/availability-
        // determined outcome, never computed here.
        expectedReturnDate,
        travelers: String(applicants.length),
        ratePerApplicant,
        indicativeTotal: ratePerApplicant * applicants.length,
        applicants,
      },
    });

    // Pay right after the form (client handover): the price comes straight
    // from Admin config, so create the payment now. A failure here must never
    // lose the Lead — staff can still send a payment link from the CRM.
    let payToken: string | undefined;
    try {
      const checkout = await createAutoCheckout({
        leadId: result.leadId,
        serviceType: "RETURN_TICKET",
        totalPrice: ratePerApplicant * applicants.length,
      });
      payToken = checkout?.token;
    } catch (checkoutError) {
      console.error("[api/leads/return-ticket] auto checkout failed", checkoutError);
    }

    return jsonSuccess({ ...result, payToken }, 201);
  } catch (error) {
    console.error("[api/leads/return-ticket]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
