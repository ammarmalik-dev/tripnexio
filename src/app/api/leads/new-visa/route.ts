import type { NextRequest } from "next/server";
import { newVisaRequestSchema } from "@/lib/validation/new-visa-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
import { findNewVisaTravellerIssues } from "@/lib/validation/new-visa-schema";
import { computePaxType } from "@/lib/leads/pax-type";

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
    travelDate,
    processingType,
    passportImageBase64,
    passportImageMimeType,
    protectionPlanInterested,
    protectionPlanTermsAccepted,
    passportNumber,
    dob,
    occupation,
    guardianFullName,
    guardianPassportNumber,
    guardianRelationship,
    additionalTravellers,
  } = parsed.data;

  const travellers = [
    {
      fullName,
      passportNumber,
      dob,
      occupation,
      guardianFullName,
      guardianPassportNumber,
      guardianRelationship,
      passportImageBase64,
      passportImageMimeType,
    },
    ...additionalTravellers,
  ];

  // Handover doc: every traveller needs a passport copy, and anyone under 18
  // needs guardian details — enforced server-side, not just by the form.
  const travellerIssues = findNewVisaTravellerIssues({
    dob,
    guardianFullName,
    guardianPassportNumber,
    guardianRelationship,
    passportImageBase64,
    additionalTravellers,
  });
  const missingMime = travellers.some((t) => t.passportImageBase64 && !t.passportImageMimeType);
  if (travellerIssues.length > 0 || missingMime) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of travellerIssues) fieldErrors[issue.path] = [issue.message];
    return jsonError(400, "Please complete every traveller's details.", fieldErrors);
  }

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
      passengers: travellers.map((t) => ({
        fullName: t.fullName,
        passportNumber: t.passportNumber,
        dob: t.dob,
        paxType: computePaxType(t.dob, travelDate),
      })),
      details: {
        destinationCountry,
        visaType,
        travelers: String(travellers.length),
        travelDate,
        // Applicant-wise record, in the same order as details.passengerIds.
        applicants: travellers.map((t) => ({
          fullName: t.fullName,
          passportNumber: t.passportNumber,
          occupation: t.occupation,
          ...(t.guardianFullName
            ? {
                guardian: {
                  fullName: t.guardianFullName,
                  passportNumber: t.guardianPassportNumber,
                  relationship: t.guardianRelationship,
                },
              }
            : {}),
        })),
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

    // Never throws (see handleOptionalPassportUpload); passengerIds follow the travellers' order.
    await Promise.all(
      travellers.map((traveller, index) =>
        handleOptionalPassportUpload({
          passengerId: result.passengerIds[index],
          imageBase64: traveller.passportImageBase64,
          mimeType: traveller.passportImageMimeType,
        })
      )
    );

    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/new-visa]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
