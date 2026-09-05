import type { NextRequest } from "next/server";
import { visaExtensionRequestSchema } from "@/lib/validation/visa-extension-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = visaExtensionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const { fullName, mobile, email, destinationCountry, entryDate, processingType } = parsed.data;

  try {
    // entryDate is required by the schema (no .optional()) — Visa Extension
    // always captures it, per the business rule.
    const result = await createLeadFromSubmission({
      serviceType: "VISA_EXTENSION",
      contact: { fullName, mobile, email },
      details: { destinationCountry, entryDate, processingType },
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/visa-extension]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
