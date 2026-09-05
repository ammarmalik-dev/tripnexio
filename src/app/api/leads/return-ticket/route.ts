import type { NextRequest } from "next/server";
import { returnTicketRequestSchema } from "@/lib/validation/return-ticket-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
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

  const { fullName, mobile, email, destinationCountry, travelDate, returnDate, travelers } = parsed.data;

  try {
    const result = await createLeadFromSubmission({
      serviceType: "RETURN_TICKET",
      contact: { fullName, mobile, email },
      details: { destinationCountry, travelDate, returnDate, travelers },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/return-ticket]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
