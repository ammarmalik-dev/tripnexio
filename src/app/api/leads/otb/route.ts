import type { NextRequest } from "next/server";
import { otbRequestSchema } from "@/lib/validation/otb-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
import { db } from "@/lib/db";
import { getOtbGlobalRules, resolveAirlineRules } from "@/lib/otb/get-otb-rules";
import { evaluateOtbTravelDate, workingDaysUntil } from "@/lib/otb/processing-rules";

export async function POST(request: NextRequest) {
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

  const {
    fullName,
    mobile,
    email,
    airline,
    travelDate,
    processingType,
    passportImageBase64,
    passportImageMimeType,
    passportNumber,
    additionalApplicants,
    hasReturnTicket,
  } = parsed.data;

  try {
    // The airline, its prices and the timeline rules all come from Admin
    // configuration — validated here (never trusted from the client), so a
    // travel date inside the processing time can't be booked with a type the
    // airline can't honour.
    const airlineRecord = await db.airline.findFirst({ where: { code: airline, active: true, otbRequired: true } });
    if (!airlineRecord) {
      return jsonError(400, "That airline isn't available for OTB.", { airline: ["Select an available airline."] });
    }
    const rules = resolveAirlineRules(airlineRecord, await getOtbGlobalRules());
    const outcome = evaluateOtbTravelDate(workingDaysUntil(travelDate), rules);
    if (outcome.status === "BLOCKED") {
      return jsonError(400, outcome.message ?? "That travel date can't be processed.", { travelDate: [outcome.message ?? "Choose a later date."] });
    }
    if (!outcome.allowed.includes(processingType)) {
      return jsonError(400, outcome.message ?? "That processing type isn't available for this airline.", {
        processingType: [outcome.message ?? "Select an available processing type."],
      });
    }

    const applicants = [{ fullName, passportNumber }, ...additionalApplicants];
    const unitPrice = Number(processingType === "urgent" ? airlineRecord.urgentPrice : airlineRecord.normalPrice);

    // No nationality field anywhere above — OTB never asks for it (business
    // rule); createLeadFromSubmission also strips one defensively if present.
    const result = await createLeadFromSubmission({
      serviceType: "OTB",
      contact: { fullName, mobile, email },
      passengers: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
      details: {
        airline,
        travelDate,
        processingType,
        travelers: String(applicants.length),
        workingDaysToTravel: outcome.workingDays,
        // Return-ticket cross-sell: staff follow up when the customer has none.
        hasReturnTicket: hasReturnTicket === "yes",
        ...(hasReturnTicket === "no" ? { returnTicketNeeded: true } : {}),
        ...(Number.isFinite(unitPrice) && unitPrice > 0
          ? { ratePerApplicant: unitPrice, indicativeTotal: unitPrice * applicants.length }
          : {}),
        applicants,
      },
    });

    await handleOptionalPassportUpload({
      passengerId: result.passengerIds[0],
      imageBase64: passportImageBase64,
      mimeType: passportImageMimeType,
    });

    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/otb]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
