import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { returnTicketRequestSchema } from "@/lib/validation/return-ticket-schema";
import { createReturnTicketRequest } from "@/lib/return-ticket/create-request";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-return-ticket", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

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

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const { fullName, mobile, email, passportNumber, destinationCountryId, travelDate, expectedReturnDate, additionalApplicants } =
    parsed.data;

  try {
    const created = await createReturnTicketRequest({
      contact: { fullName, mobile, email },
      applicants: [{ fullName, passportNumber }, ...additionalApplicants],
      destinationCountryId,
      travelDate,
      expectedReturnDate,
    });
    if (!created.ok) return jsonError(400, created.message, created.fieldErrors);
    return jsonSuccess({ ...created.lead, payToken: created.payToken }, 201);
  } catch (error) {
    console.error("[api/leads/return-ticket]", describeError(error));
    return jsonError(500, "Something went wrong while submitting your request. Please try again.");
  }
}
