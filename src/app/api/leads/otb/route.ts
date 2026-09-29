import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { rejectInvalidUploads, ALLOWED_UPLOAD_MIME_TYPES as IMAGE_OR_PDF } from "@/lib/uploads/validate-upload";
import { otbRequestSchema } from "@/lib/validation/otb-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
import { db } from "@/lib/db";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { resolveOtbApplicantPrices } from "@/lib/otb/pricing";
import { createReturnTicketRequest } from "@/lib/return-ticket/create-request";
import { linkServiceBookings } from "@/lib/return-ticket/operations";
import { getOtbGlobalRules, resolveAirlineRules } from "@/lib/otb/get-otb-rules";
import { evaluateOtbTravelDate } from "@/lib/otb/processing-rules";
import { getWorkingCalendar } from "@/lib/calendar/get-working-calendar";
import { createTask } from "@/lib/tasks/create-task";
import { describeError } from "@/lib/api/describe-error";
import { isActiveProcessingType } from "@/lib/processing-types/get";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-otb", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = otbRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const uploadError = rejectInvalidUploads([parsed.data.passportImageBase64], IMAGE_OR_PDF);
  if (uploadError) return uploadError;

  const {
    fullName,
    mobile,
    email,
    destinationCountry,
    airline,
    travelDate,
    processingType,
    passportImageBase64,
    passportImageMimeType,
    passportNumber,
    paxType,
    additionalApplicants,
    hasReturnTicket,
    addReturnTicket,
    returnDestinationCountryId,
    expectedReturnDate,
  } = parsed.data;
  // P18 — a Return Verified Ticket added to this order (only when the customer has none).
  const wantsReturnTicket = hasReturnTicket === "no" && addReturnTicket === "yes" && !!returnDestinationCountryId && !!expectedReturnDate;

  try {
    // The airline, its prices and the timeline rules all come from Admin
    // configuration — validated here (never trusted from the client), so a
    // travel date inside the processing time can't be booked with a type the
    // airline can't honour.
    // P23 — the processing type must be an active option in the Admin master
    // (a code Admin disabled is hidden from the form and rejected here too).
    if (!(await isActiveProcessingType("OTB", processingType))) {
      return jsonError(400, "That processing type isn't available.", { processingType: ["Select an available processing type."] });
    }
    const airlineRecord = await db.airline.findFirst({ where: { code: airline, active: true, otbRequired: true } });
    if (!airlineRecord) {
      return jsonError(400, "That airline isn't available for OTB.", { airline: ["Select an available airline."] });
    }
    const rules = resolveAirlineRules(airlineRecord, await getOtbGlobalRules());
    // P09 — enforced against the Admin-configured India working calendar
    // (weekends, holidays, business hours, timezone).
    const outcome = evaluateOtbTravelDate(travelDate, rules, new Date(), await getWorkingCalendar("INDIA"));
    if (outcome.status === "BLOCKED") {
      return jsonError(400, outcome.message ?? "That travel date can't be processed.", { travelDate: [outcome.message ?? "Choose a later date."] });
    }
    if (!outcome.allowed.includes(processingType)) {
      return jsonError(400, outcome.message ?? "That processing type isn't available for this airline.", {
        processingType: [outcome.message ?? "Select an available processing type."],
      });
    }

    if (wantsReturnTicket) {
      const destination = await db.returnTicketDestination.findFirst({
        where: { countryId: returnDestinationCountryId, active: true, country: { active: true } },
        select: { id: true },
      });
      if (!destination) {
        return jsonError(400, "That return ticket destination isn't available right now.", {
          returnDestinationCountryId: ["Select an available destination."],
        });
      }
    }

    const applicants = [
      { fullName, passportNumber, paxType: paxType ?? "ADULT" },
      ...additionalApplicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber, paxType: a.paxType ?? "ADULT" })),
    ];
    // P18 — priced per applicant: Admin OTB price for airline + destination +
    // passenger type, falling back to the airline's own normal/urgent price.
    const applicantPrices = await resolveOtbApplicantPrices({
      airline: airlineRecord,
      countryCode: destinationCountry,
      processingType,
      paxTypes: applicants.map((a) => a.paxType),
    });
    const priced = applicantPrices.every((price): price is number => price !== null && Number.isFinite(price) && price > 0);
    const totalPrice = priced ? applicantPrices.reduce<number>((sum, price) => sum + (price ?? 0), 0) : 0;

    // No nationality field anywhere above — OTB never asks for it (business
    // rule); createLeadFromSubmission also strips one defensively if present.
    const result = await createLeadFromSubmission({
      serviceType: "OTB",
      contact: { fullName, mobile, email },
      passengers: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
      details: {
        destinationCountry,
        airline,
        travelDate,
        processingType,
        travelers: String(applicants.length),
        workingDaysToTravel: outcome.workingDays,
        // Return-ticket cross-sell: staff follow up when the customer has none.
        hasReturnTicket: hasReturnTicket === "yes",
        ...(hasReturnTicket === "no" ? { returnTicketNeeded: true } : {}),
        ...(priced ? { applicantPrices, indicativeTotal: totalPrice } : {}),
        ...(wantsReturnTicket ? { returnTicketAddedToOrder: true } : {}),
        applicants,
      },
    });

    await handleOptionalPassportUpload({
      passengerId: result.passengerIds[0],
      imageBase64: passportImageBase64,
      mimeType: passportImageMimeType,
    });

    // OTB -> Return Ticket cross-sell automation: a real, staff-visible Task
    // instead of only the returnTicketNeeded flag buried in Lead.details JSON.
    if (hasReturnTicket === "no" && !wantsReturnTicket) {
      await db.$transaction((tx) =>
        createTask(tx, {
          type: "CROSS_SELL_FOLLOW_UP",
          priority: "NORMAL",
          title: `Offer Return Ticket to ${fullName}`,
          reason: "OTB customer has no existing return ticket yet.",
          entityType: "Lead",
          entityId: result.leadId,
          leadId: result.leadId,
          serviceType: "OTB",
        })
      );
    }


    // Pay right after the form when the airline has a configured price for
    // this processing type (see the return-ticket route for the failure rule).
    let payToken: string | undefined;
    let otbBookingId: string | undefined;
    try {
      const checkout = await createAutoCheckout({
        leadId: result.leadId,
        serviceType: "OTB",
        totalPrice,
      });
      payToken = checkout?.token;
      otbBookingId = checkout?.bookingId;
    } catch (checkoutError) {
      console.error("[api/leads/otb] auto checkout failed", describeError(checkoutError));
    }

    // P18 — the Return Verified Ticket added in the same order: its own
    // lead/booking/payment (a separate service record, CRM.md §15), linked
    // both ways to this OTB booking. Its issuance stays blocked until this
    // OTB is approved (P17). A failure here never loses the OTB request.
    let returnTicketPayToken: string | undefined;
    if (wantsReturnTicket) {
      try {
        const rt = await createReturnTicketRequest({
          contact: { fullName, mobile, email },
          applicants: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
          destinationCountryId: returnDestinationCountryId as string,
          travelDate,
          expectedReturnDate: expectedReturnDate as string,
          source: "OTB order",
          extraDetails: { otbLeadId: result.leadId },
        });
        if (rt.ok) {
          returnTicketPayToken = rt.payToken;
          if (otbBookingId && rt.bookingId) {
            const rtBookingId = rt.bookingId;
            const bookingId = otbBookingId;
            await db.$transaction((tx) =>
              linkServiceBookings(tx, { bookingId, otherBookingId: rtBookingId, actorLabel: "added together in the OTB order" })
            );
          }
        }
      } catch (returnTicketError) {
        console.error("[api/leads/otb] return ticket add-on failed", describeError(returnTicketError));
      }
    }

    return jsonSuccess({ ...result, payToken, returnTicketPayToken }, 201);
  } catch (error) {
    console.error("[api/leads/otb]", describeError(error));
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
