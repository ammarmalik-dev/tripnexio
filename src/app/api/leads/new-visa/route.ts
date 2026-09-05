import type { NextRequest } from "next/server";
import { newVisaRequestSchema } from "@/lib/validation/new-visa-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = newVisaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const { fullName, mobile, email, destinationCountry, visaType, travelers, travelDate, processingType } =
    parsed.data;

  try {
    const result = await createLeadFromSubmission({
      serviceType: "NEW_VISA",
      contact: { fullName, mobile, email },
      details: { destinationCountry, visaType, travelers, travelDate, processingType },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/new-visa]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
