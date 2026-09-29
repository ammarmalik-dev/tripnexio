import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { contactRequestSchema } from "@/lib/validation/contact-schema";
import { createLeadFromSubmission } from "@/lib/leads/create-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";

/**
 * P20 — the public Contact form. Creates an OTHER lead (same customer
 * matching, audit trail and "request received" notification as every
 * service form) so the enquiry lands in the CRM for staff follow-up.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "leads-contact", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  if (isHoneypotFilled(parsed.data.website)) return jsonError(400, "Invalid submission.");

  const { fullName, mobile, email, subject, message, bookingReference } = parsed.data;
  try {
    const result = await createLeadFromSubmission({
      serviceType: "OTHER",
      source: "Contact form",
      contact: { fullName, mobile, email },
      details: { subject, message, ...(bookingReference ? { bookingReference } : {}) },
    });
    return jsonSuccess({ referenceId: result.referenceId }, 201);
  } catch (error) {
    console.error("[api/leads/contact]", describeError(error));
    return jsonError(500, "Something went wrong while sending your message. Please try again.");
  }
}
