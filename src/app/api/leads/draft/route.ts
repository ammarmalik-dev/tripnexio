import type { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { isHoneypotFilled } from "@/lib/validation/honeypot";
import { LEAD_INTAKE_RATE_LIMIT } from "@/lib/leads/intake-limits";
import { leadDraftSchema } from "@/lib/validation/lead-draft-schema";
import { createOrRefreshDraftLead } from "@/lib/leads/create-draft-lead";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";

/**
 * P21 — abandoned-form capture. Public; called fire-and-forget by
 * MultiStepRequestFlow when a visitor leaves a service form's contact step.
 * Creates/refreshes one draft Lead per (customer, serviceType); the full
 * submission later takes that same Lead over (see abandoned-draft.ts).
 * Never notifies the customer. The response deliberately carries no lead id
 * or reference — nothing the public caller needs.
 */
export async function POST(request: NextRequest) {
  // Its own bucket (not shared with the full-submission routes) so a visitor's
  // step-1 captures never eat into their real submission budget.
  const limited = await rateLimitByIp(request, "leads-draft", LEAD_INTAKE_RATE_LIMIT, "Too many requests. Please try again later.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = leadDraftSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (isHoneypotFilled(parsed.data.website)) {
    return jsonError(400, "Invalid submission.");
  }

  const { serviceType, fullName, mobile, email } = parsed.data;
  try {
    const result = await createOrRefreshDraftLead(serviceType, { fullName, mobile, email });
    return jsonSuccess({ saved: true, outcome: result.outcome }, result.outcome === "created" ? 201 : 200);
  } catch (error) {
    console.error("[api/leads/draft]", describeError(error));
    return jsonError(500, "Couldn't save your progress.");
  }
}
