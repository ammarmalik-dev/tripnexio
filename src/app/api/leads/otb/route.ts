import type { NextRequest } from "next/server";
import { otbRequestSchema } from "@/lib/validation/otb-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

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

  const { fullName, mobile, email, airline, travelDate, processingType } = parsed.data;

  try {
    // No nationality field anywhere above — OTB never asks for it (business
    // rule); createLeadFromSubmission also strips one defensively if present.
    const result = await createLeadFromSubmission({
      serviceType: "OTB",
      contact: { fullName, mobile, email },
      details: { airline, travelDate, processingType },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/otb]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
