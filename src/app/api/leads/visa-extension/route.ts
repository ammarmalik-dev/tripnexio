import type { NextRequest } from "next/server";
import { visaExtensionRequestSchema } from "@/lib/validation/visa-extension-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { checkVisaExtensionEligibility, getIneligibleRedirect } from "@/lib/leads/visa-extension-eligibility";
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

  const { fullName, mobile, email, passportNumber, dob, insideUAE, entryDate } = parsed.data;

  try {
    // Visa_Extension.md §2/§25: no Extension lead is created until an
    // eligible TripNexio-issued visa is found — a hard business rule
    // enforced server-side here, not left to the frontend to skip.
    const eligibility = await checkVisaExtensionEligibility({ passportNumber, dob, mobile });
    if (!eligibility.eligible) {
      const redirect = getIneligibleRedirect(insideUAE);
      return jsonSuccess(
        {
          eligible: false,
          redirect,
          message:
            "We currently provide visa extension services only for visas issued through TripNexio. We couldn't find a matching TripNexio-issued visa for these details.",
        },
        200
      );
    }

    const result = await createLeadFromSubmission({
      serviceType: "VISA_EXTENSION",
      contact: { fullName, mobile, email },
      details: { passportNumber, dob, insideUAE, entryDate, originalVisaLeadId: eligibility.matchedLeadId },
    });
    return jsonSuccess({ eligible: true, ...result }, 201);
  } catch (error) {
    console.error("[api/leads/visa-extension]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
