import type { NextRequest } from "next/server";
import { visaExtensionRequestSchema } from "@/lib/validation/visa-extension-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { checkVisaExtensionEligibility, getIneligibleRedirect } from "@/lib/leads/visa-extension-eligibility";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
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

  const {
    fullName,
    mobile,
    email,
    passportNumber,
    dob,
    insideUAE,
    entryDate,
    passportImageBase64,
    passportImageMimeType,
    additionalApplicants,
  } = parsed.data;

  const applicants = [
    { fullName, passportNumber, dob, entryDate, passportImageBase64, passportImageMimeType, isPrimary: true },
    ...additionalApplicants.map((applicant) => ({ ...applicant, isPrimary: false })),
  ];

  try {
    // Visa_Extension.md §2/§25: no Extension lead is created until an
    // eligible TripNexio-issued visa is found — a hard business rule
    // enforced server-side here, not left to the frontend to skip. Every
    // applicant is checked individually by passport + DOB; the primary
    // applicant's mobile is only used for their own lookup (an additional
    // applicant matching on the primary's mobile would prove nothing about
    // that person's visa).
    const eligibilities = await Promise.all(
      applicants.map((applicant) =>
        checkVisaExtensionEligibility({
          passportNumber: applicant.passportNumber,
          dob: applicant.dob,
          mobile: applicant.isPrimary ? mobile : undefined,
        })
      )
    );
    const ineligibleApplicants = applicants.filter((_, index) => !eligibilities[index].eligible).map((a) => a.fullName);
    if (ineligibleApplicants.length > 0) {
      const redirect = getIneligibleRedirect(insideUAE);
      return jsonSuccess(
        {
          eligible: false,
          redirect,
          ineligibleApplicants,
          message:
            "We currently provide visa extension services only for visas issued through TripNexio. We couldn't find a matching TripNexio-issued visa for these details.",
        },
        200
      );
    }

    const result = await createLeadFromSubmission({
      serviceType: "VISA_EXTENSION",
      contact: { fullName, mobile, email },
      passengers: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber, dob: a.dob })),
      details: {
        passportNumber,
        dob,
        insideUAE,
        entryDate,
        originalVisaLeadId: eligibilities[0].matchedLeadId,
        // Applicant-wise record, in the same order as details.passengerIds.
        applicants: applicants.map((a, index) => ({
          fullName: a.fullName,
          passportNumber: a.passportNumber,
          entryDate: a.entryDate,
          originalVisaLeadId: eligibilities[index].matchedLeadId,
        })),
      },
    });

    // Documents were mandatory in the form; each is attached to its own
    // applicant. Never throws (see handleOptionalPassportUpload).
    await Promise.all(
      applicants.map((applicant, index) =>
        handleOptionalPassportUpload({
          passengerId: result.passengerIds[index],
          imageBase64: applicant.passportImageBase64,
          mimeType: applicant.passportImageMimeType,
        })
      )
    );

    return jsonSuccess({ eligible: true, ...result }, 201);
  } catch (error) {
    console.error("[api/leads/visa-extension]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
