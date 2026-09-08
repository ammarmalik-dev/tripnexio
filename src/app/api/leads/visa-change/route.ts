import type { NextRequest } from "next/server";
import { visaChangeRequestSchema } from "@/lib/validation/visa-change-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

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

  const { fullName, passportNumber, visaLastDate, mobile, email, nationality, paxType, additionalPassengers, changeType } = parsed.data;

  const allPassengers = [
    { fullName, passportNumber, visaLastDate, nationality, paxType },
    ...additionalPassengers,
  ];

  try {
    const result = await createLeadFromSubmission({
      serviceType: "VISA_CHANGE",
      contact: { fullName, mobile, email },
      passengers: allPassengers.map((p) => ({
        fullName: p.fullName,
        passportNumber: p.passportNumber,
        nationality: p.nationality,
        paxType: p.paxType,
      })),
      details: {
        changeType,
        // visaLastDate has no dedicated Passenger column (it's tied to
        // THIS specific visa being changed, not a permanent passenger
        // attribute) -- kept as lead-scoped data, keyed by passport number
        // so it stays associated with the right passenger even though the
        // Passenger rows themselves are matched/created separately above.
        passengers: allPassengers.map((p) => ({ passportNumber: p.passportNumber, visaLastDate: p.visaLastDate })),
      },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/visa-change]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
