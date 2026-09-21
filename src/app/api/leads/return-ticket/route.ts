import type { NextRequest } from "next/server";
import { returnTicketRequestSchema } from "@/lib/validation/return-ticket-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { computeReturnDate } from "@/lib/leads/compute-return-date";
import { getReturnTicketRules } from "@/lib/settings/return-ticket-rule-config";
import { db } from "@/lib/db";
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

  const { fullName, mobile, email, passportNumber, destinationCountryId, visaType, travelDate, additionalApplicants } =
    parsed.data;

  try {
    // The destination, its rate and its allowed validity options all come
    // from Admin configuration (ReturnTicketDestination) — validated here,
    // never trusted from the client.
    const destination = await db.returnTicketDestination.findFirst({
      where: { countryId: destinationCountryId, active: true, country: { active: true } },
      include: { country: { select: { name: true } } },
    });
    if (!destination) {
      return jsonError(400, "That destination isn't available right now.", {
        destinationCountryId: ["Select an available destination."],
      });
    }
    if (!destination.validityOptions.includes(visaType)) {
      return jsonError(400, "That visa validity isn't offered for this destination.", {
        visaType: ["Select one of the validity options offered for this destination."],
      });
    }

    // Return_Verified_Ticket.md §5/§6: the customer never enters a return
    // date — it's computed here from the selected visa type + the
    // Admin-configurable offset rule.
    const rules = await getReturnTicketRules();
    const returnDate = computeReturnDate(travelDate, visaType, rules);

    const applicants = [{ fullName, passportNumber }, ...additionalApplicants];
    const ratePerApplicant = Number(destination.ratePerApplicant);

    const result = await createLeadFromSubmission({
      serviceType: "RETURN_TICKET",
      contact: { fullName, mobile, email },
      passengers: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
      details: {
        destinationCountry: destination.country.name,
        destinationCountryId,
        visaType,
        travelDate,
        returnDate,
        travelers: String(applicants.length),
        ratePerApplicant,
        indicativeTotal: ratePerApplicant * applicants.length,
        applicants,
      },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/return-ticket]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
