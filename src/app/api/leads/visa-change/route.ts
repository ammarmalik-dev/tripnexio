import type { NextRequest } from "next/server";
import { visaChangeRequestSchema } from "@/lib/validation/visa-change-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { handleOptionalPassportUpload } from "@/lib/ocr/handle-passport-upload";
import { findMissingPassportImages } from "@/lib/validation/visa-change-schema";
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
    {
      fullName,
      passportNumber,
      visaLastDate,
      nationality,
      paxType,
      passportImageBase64: parsed.data.passportImageBase64,
      passportImageMimeType: parsed.data.passportImageMimeType,
    },
    ...additionalPassengers,
  ];

  // Handover doc: every applicant's passport copy is required before the
  // Lead is created — enforced server-side, not just by the form.
  const missingImages = findMissingPassportImages({
    passportImageBase64: parsed.data.passportImageBase64,
    additionalPassengers,
  });
  const missingMime = allPassengers.some((p) => p.passportImageBase64 && !p.passportImageMimeType);
  if (missingImages.length > 0 || missingMime) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of missingImages) fieldErrors[issue.path] = [issue.message];
    return jsonError(400, "Please upload a passport copy for every applicant.", fieldErrors);
  }

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

    // Never throws (see handleOptionalPassportUpload); passengerIds follow allPassengers' order.
    await Promise.all(
      allPassengers.map((passenger, index) =>
        handleOptionalPassportUpload({
          passengerId: result.passengerIds[index],
          imageBase64: passenger.passportImageBase64,
          mimeType: passenger.passportImageMimeType,
        })
      )
    );
    return jsonSuccess(result, 201);
  } catch (error) {
    console.error("[api/leads/visa-change]", error);
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
