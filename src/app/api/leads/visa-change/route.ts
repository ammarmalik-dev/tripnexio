import type { NextRequest } from "next/server";
import { visaChangeRequestSchema } from "@/lib/validation/visa-change-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = visaChangeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const { fullName, mobile, email, processingType, changeType } = parsed.data;

  // Zod only checked that these ids are non-empty strings — the customer
  // picked them from a <select>, but the API still confirms server-side
  // that they're real, active master rows (never trust a client-sent id).
  if (changeType === "AIRPORT_TO_AIRPORT") {
    const { departureAirportId, arrivalAirportId } = parsed.data;
    const [departure, arrival] = await Promise.all([
      db.airport.findUnique({ where: { id: departureAirportId } }),
      db.airport.findUnique({ where: { id: arrivalAirportId } }),
    ]);
    if (!departure || !departure.active || !departure.activeForA2AExit) {
      return jsonError(400, "Select a valid departure airport.", {
        departureAirportId: ["This airport isn't available for Airport-to-Airport exit."],
      });
    }
    if (!arrival || !arrival.active || !arrival.activeForA2AEntry) {
      return jsonError(400, "Select a valid arrival airport.", {
        arrivalAirportId: ["This airport isn't available for Airport-to-Airport entry."],
      });
    }
  } else {
    const { borderId } = parsed.data;
    const border = await db.border.findUnique({ where: { id: borderId } });
    if (!border || !border.active || !border.activeForVisaChange) {
      return jsonError(400, "Select a valid border crossing.", {
        borderId: ["This border crossing isn't available for Visa Change."],
      });
    }
  }

  try {
    const details =
      changeType === "AIRPORT_TO_AIRPORT"
        ? {
            changeType,
            departureAirportId: parsed.data.departureAirportId,
            arrivalAirportId: parsed.data.arrivalAirportId,
            processingType,
          }
        : { changeType, borderId: parsed.data.borderId, processingType };

    const result = await createLeadFromSubmission({
      serviceType: "VISA_CHANGE",
      contact: { fullName, mobile, email },
      details,
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/visa-change]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
