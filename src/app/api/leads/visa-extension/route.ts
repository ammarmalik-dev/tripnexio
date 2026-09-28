import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { rejectInvalidUploads, ALLOWED_UPLOAD_MIME_TYPES as IMAGE_OR_PDF } from "@/lib/uploads/validate-upload";
import { visaExtensionRequestSchema } from "@/lib/validation/visa-extension-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-visa-extension", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

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

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const uploadError = rejectInvalidUploads([parsed.data.passportImageBase64, parsed.data.visaImageBase64, ...parsed.data.additionalApplicants.flatMap((applicant) => [applicant.passportImageBase64, applicant.visaImageBase64])], IMAGE_OR_PDF);
  if (uploadError) return uploadError;

  const {
    fullName,
    mobile,
    email,
    passportNumber,
    visaExpiryDate,
    passportImageBase64,
    passportImageMimeType,
    visaImageBase64,
    visaImageMimeType,
    additionalApplicants,
  } = parsed.data;

  const applicants = [
    { fullName, passportNumber, visaExpiryDate, passportImageBase64, passportImageMimeType, visaImageBase64, visaImageMimeType },
    ...additionalApplicants,
  ];

  try {
    // Per the Visa Extension handover doc, staff — not the intake form —
    // decide eligibility: the Lead is always created, and the CRM lead page
    // shows each applicant's passport-number match against prior TripNexio
    // visas (or the absence of one) for staff to act on.
    const result = await createLeadFromSubmission({
      serviceType: "VISA_EXTENSION",
      contact: { fullName, mobile, email },
      passengers: applicants.map((a) => ({ fullName: a.fullName, passportNumber: a.passportNumber })),
      details: {
        passportNumber,
        visaExpiryDate,
        // Applicant-wise record, in the same order as details.passengerIds.
        applicants: applicants.map((a) => ({
          fullName: a.fullName,
          passportNumber: a.passportNumber,
          visaExpiryDate: a.visaExpiryDate,
        })),
      },
    });

    // Both documents were mandatory in the form; each is attached to its
    // own applicant. Neither call throws (see handleOptionalPassportUpload).
    await Promise.all(
      applicants.flatMap((applicant, index) => [
        handleOptionalPassportUpload({
          passengerId: result.passengerIds[index],
          imageBase64: applicant.passportImageBase64,
          mimeType: applicant.passportImageMimeType,
          documentType: "PASSPORT",
        }),
        handleOptionalPassportUpload({
          passengerId: result.passengerIds[index],
          imageBase64: applicant.visaImageBase64,
          mimeType: applicant.visaImageMimeType,
          documentType: "VISA_COPY",
        }),
      ])
    );

    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/visa-extension]", describeError(error));
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
