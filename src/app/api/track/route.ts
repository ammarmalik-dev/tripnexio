import type { NextRequest } from "next/server";
import { trackSchema } from "@/lib/validation/track-schema";
import { trackByReferenceId } from "@/lib/track/lookup";
import { jsonError, jsonSuccess } from "@/lib/api/respond";

/**
 * Public, unauthenticated lookup — deliberately no staff/customer session
 * check, matching the doc-described UX ("request only the minimum reference
 * information needed to locate the relevant record"). Returns only the
 * customer-safe fields `trackByReferenceId` already builds — never passport
 * numbers, internal notes, vendor/cost data, or staff names.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = trackSchema.safeParse({ referenceId: searchParams.get("referenceId") ?? "" });
  if (!parsed.success) {
    return jsonError(400, "Enter a booking or reference ID.", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await trackByReferenceId(parsed.data.referenceId);
    if (!result) return jsonError(404, "We couldn't find that request.");
    return jsonSuccess(result);
  } catch (error) {
    console.error("[api/track]", error);
    return jsonError(500, "Something went wrong while checking that request. Please try again.");
  }
}
