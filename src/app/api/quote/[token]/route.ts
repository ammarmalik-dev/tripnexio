import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { loadQuoteReviewByToken } from "@/lib/quotations/load-quote-review";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Public, token-gated — the guest customer's quote-review page data. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const review = await loadQuoteReviewByToken(token);
  if (!review) return jsonError(404, "We couldn't find that page. Please check the link.");
  return jsonSuccess(review);
}
