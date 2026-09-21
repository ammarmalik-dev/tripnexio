import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { loadCheckoutByToken } from "@/lib/checkout/load-checkout";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Public, token-gated — the guest customer's payment/document page data. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const checkout = await loadCheckoutByToken(token);
  if (!checkout) return jsonError(404, "We couldn't find that payment page. Please check the link.");
  return jsonSuccess(checkout.view);
}
