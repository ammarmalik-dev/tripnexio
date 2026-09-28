import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { clientIp, rateLimitByIp } from "@/lib/auth/rate-limit";
import { recordTermsAcceptance } from "@/lib/terms/service-terms";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const bodySchema = z.object({ accepted: z.literal(true, { error: "Please agree to the Terms & Conditions." }) });

/** Public, token-gated: the customer agrees to the Terms on /pay/<token> (P09). Stores version, time and IP on the booking. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "pay-accept-terms", { limit: 30, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "Payment page not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  if (!bodySchema.safeParse(body).success) return jsonError(400, "Please agree to the Terms & Conditions.");

  const booking = await db.booking.findUnique({ where: { customerToken: token }, include: { lead: true } });
  if (!booking) return jsonError(404, "Payment page not found.");

  await recordTermsAcceptance(booking, clientIp(request), "pay page");
  return jsonSuccess({ accepted: true });
}
