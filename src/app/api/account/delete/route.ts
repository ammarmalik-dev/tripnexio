import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { CUSTOMER_SESSION_COOKIE_NAME } from "@/lib/auth/customer-session";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { confirmAccountDeletion, otpCodeSchema, requestAccountDeletion } from "@/lib/account/account-changes";

const bodySchema = z.object({ code: otpCodeSchema.optional() });

/**
 * Client doc 2026-10-15 (J7) — the signed-in customer deletes their account. Without `code` it emails the
 * confirmation code; with `code` it removes the login, ends the session and keeps the records the law requires.
 */
export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return jsonError(401, "Please log in.");
  const limited = await rateLimitByIp(request, "account-delete", { limit: 6, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    if (!parsed.data.code) {
      const result = await requestAccountDeletion(session.id);
      if (!result.ok) return jsonError(result.status, result.error);
      return jsonSuccess({ codeSent: true, maskedEmail: result.maskedEmail });
    }
    const result = await confirmAccountDeletion(session.id, parsed.data.code);
    if (!result.ok) return jsonError(result.status, result.error, result.field ? { [result.field]: [result.error] } : undefined);
    (await cookies()).delete(CUSTOMER_SESSION_COOKIE_NAME);
    return jsonSuccess({ deleted: true });
  } catch (error) {
    console.error("[api/account/delete] failed", describeError(error));
    return jsonError(500, "Couldn't delete your account. Please try again or contact us.");
  }
}
