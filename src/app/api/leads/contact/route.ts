import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { contactRequestSchema } from "@/lib/validation/contact-schema";
import { createEnquiry } from "@/lib/enquiries/create-enquiry";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";

/**
 * The public Contact form. Creates an Enquiry (CRM → Enquiries) with the
 * category the customer chose; staff can convert a genuine business
 * enquiry to a lead. A complaint is escalated straight away and never
 * becomes a lead (client request 2026-10-03). Same URL as before so the
 * form keeps working.
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

  const { category, fullName, mobile, email, subject, message, bookingReference } = parsed.data;
  try {
    const result = await createEnquiry({ category, fullName, mobile, email, subject, message, bookingReference });
    return jsonSuccess({ referenceId: result.reference, isComplaint: category === "COMPLAINT" }, 201);
  } catch (error) {
    console.error("[api/leads/contact]", describeError(error));
    return jsonError(500, "Something went wrong while sending your message. Please try again.");
  }
}
