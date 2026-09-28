import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { flightSpecialFareRequestSchema } from "@/lib/validation/flight-special-fare-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { computePaxType } from "@/lib/leads/pax-type";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-flight-special-fare", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = flightSpecialFareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const { fullName, mobile, email, origin, destination, travelDate, returnDate, passengers } = parsed.data;

  try {
    // Flight_Special_Fare.md §7: passenger type is computed from DOB on
    // travel date, never trusted from the client.
    const result = await createLeadFromSubmission({
      serviceType: "FLIGHT_SPECIAL_FARE",
      contact: { fullName, mobile, email },
      passengers: passengers.map((passenger) => ({
        fullName: passenger.fullName,
        dob: passenger.dob,
        paxType: computePaxType(passenger.dob, travelDate),
      })),
      details: {
        origin,
        destination,
        travelDate,
        returnDate,
        passengerCount: passengers.length,
      },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/flight-special-fare]", describeError(error));
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
