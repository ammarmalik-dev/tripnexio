import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { confirmContactChange, contactChangeSchema, otpCodeSchema, requestContactChange } from "@/lib/account/account-changes";

const bodySchema = z.intersection(contactChangeSchema, z.object({ code: otpCodeSchema.optional() }));

/**
 * Client doc 2026-10-15 (J7) — change the signed-in customer's email or mobile. Without `code` it emails the
 * 6-digit confirmation code (to the new email, or to the current email for a mobile change); with `code` it
 * saves the change.
 */
export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return jsonError(401, "Please log in.");
  const limited = await rateLimitByIp(request, "account-contact", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { code, ...change } = parsed.data;

  try {
    if (!code) {
      const result = await requestContactChange(session.id, change);
      if (!result.ok) return jsonError(result.status, result.error, result.field ? { [result.field]: [result.error] } : undefined);
      return jsonSuccess({ codeSent: true, maskedEmail: result.maskedEmail });
    }
    const result = await confirmContactChange(session.id, change, code);
    if (!result.ok) return jsonError(result.status, result.error, result.field ? { [result.field]: [result.error] } : undefined);
    return jsonSuccess({ changed: true });
  } catch (error) {
    console.error("[api/account/contact] failed", describeError(error));
    return jsonError(500, "Couldn't update your details. Please try again.");
  }
}
