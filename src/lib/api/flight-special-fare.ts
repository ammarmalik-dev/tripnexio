import type { FlightSpecialFareRequestValues } from "@/lib/validation/flight-special-fare-schema";
import type { CreateLeadResult } from "@/lib/leads/create-lead";
import { postJson } from "./client";

export async function submitFlightSpecialFareRequest(
  values: FlightSpecialFareRequestValues
): Promise<CreateLeadResult> {
  return postJson<CreateLeadResult>("/api/leads/flight-special-fare", values);
}
