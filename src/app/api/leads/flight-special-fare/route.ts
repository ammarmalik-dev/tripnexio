import type { NextRequest } from "next/server";
import { flightSpecialFareRequestSchema } from "@/lib/validation/flight-special-fare-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
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

  const { fullName, mobile, email, origin, destination, travelDate, returnDate, passengers } = parsed.data;

  try {
    const result = await createLeadFromSubmission({
      serviceType: "FLIGHT_SPECIAL_FARE",
      contact: { fullName, mobile, email },
      details: { origin, destination, travelDate, returnDate, passengers },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/flight-special-fare]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
