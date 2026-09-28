import type { NextRequest } from "next/server";
import { trackSchema } from "@/lib/validation/track-schema";
import { trackByReferenceId } from "@/lib/track/lookup";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { describeError } from "@/lib/api/describe-error";

/**
 * Public lookup — no session, but the caller must supply the reference AND
 * the last 4 mobile digits or the email on the request (POST body, so none of
 * it ends up in URLs or logs). Rate-limited per IP. Returns only customer-safe
 * fields with the name masked; a wrong verifier looks exactly like "not found".
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "track", { limit: 20, windowMs: 15 * 60 * 1000 }, "Too many lookups. Please try again in a few minutes.");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Enter your reference ID and the last 4 digits of your mobile number or your email.", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await trackByReferenceId(parsed.data.referenceId, parsed.data.verifier);
    if (!result) return jsonError(404, "We couldn't find a request matching those details.");
    return jsonSuccess(result);
  } catch (error) {
    console.error("[api/track]", describeError(error));
    return jsonError(500, "Something went wrong while checking that request. Please try again.");
  }
}
