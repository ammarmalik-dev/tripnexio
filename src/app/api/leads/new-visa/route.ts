import type { NextRequest } from "next/server";
import { newVisaRequestSchema } from "@/lib/validation/new-visa-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";

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

  const {
    fullName,
    mobile,
    email,
    destinationCountry,
    visaType,
    travelers,
    travelDate,
    processingType,
    passportImageBase64,
    passportImageMimeType,
    protectionPlanInterested,
    protectionPlanTermsAccepted,
  } = parsed.data;

  // New_Visa.md §8: "without agreement the Protection Plan cannot be
  // purchased" — even though this is only an expressed-interest flag, not
  // a real purchase, server-side validation still shouldn't trust a client
  // that sends interested:true without also sending termsAccepted:true.
  if (protectionPlanInterested && !protectionPlanTermsAccepted) {
    return jsonError(400, "Accept the Protection Plan terms to express interest, or leave it unchecked.", {
      protectionPlanTermsAccepted: ["Accept the terms first."],
    });
  }

  try {
    const result = await createLeadFromSubmission({
      serviceType: "NEW_VISA",
      contact: { fullName, mobile, email },
      details: {
        destinationCountry,
        visaType,
        travelers,
        travelDate,
        processingType,
        // Step 20 (audit §7.1) — expressed interest only, captured at
        // intake time; the ACTUAL Protection Plan purchase (with a real
        // per-passenger record and price) only happens once a Booking
        // exists — see POST /api/bookings, which pre-offers it to every
        // passenger on a NEW_VISA booking regardless of this flag. Staff
        // sees this on the Lead as a heads-up that the customer already
        // expressed interest and acknowledged the terms shown at intake.
        ...(protectionPlanInterested
          ? { protectionPlanInterested: true, protectionPlanTermsAcceptedAt: new Date().toISOString() }
          : {}),
      },
    });

    await handleOptionalPassportUpload({
      passengerId: result.passengerIds[0],
      imageBase64: passportImageBase64,
      mimeType: passportImageMimeType,
    });

    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/new-visa]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
