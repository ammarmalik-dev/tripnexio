import type { NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/forgot-password-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { clientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { createCustomerPasswordResetToken } from "@/lib/auth/customer-password-reset";
import { sendCustomerPasswordResetEmail } from "@/lib/auth/send-password-reset-email";
import { writeAudit } from "@/lib/audit/log";
import { siteConfig } from "@/lib/site-config";
import { describeError } from "@/lib/api/describe-error";

const GENERIC_MESSAGE = "If that email address belongs to a TripNexio account, a password reset link has been sent.";

/**
 * P09 — customer "forgot password". Always the same 200 response whether
 * or not the email exists (and even when the per-email limit trips), so it
 * can't be used to discover accounts — same posture as the staff route.
 */
export async function POST(request: NextRequest) {
  if (await isRateLimited(`customer-forgot-password-ip:${clientIp(request)}`)) {
    return jsonError(429, "Too many requests. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const email = parsed.data.email.toLowerCase();
  if (await isRateLimited(`customer-forgot-password-email:${email}`)) {
    return jsonSuccess({ message: GENERIC_MESSAGE });
  }

  const customer = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (customer?.email) {
    try {
      const token = await createCustomerPasswordResetToken(customer.id);
      await sendCustomerPasswordResetEmail(customer.email, customer.name, `${siteConfig.url}/reset-password?token=${token}`);
      await writeAudit(db, {
        entityType: "Customer",
        entityId: customer.id,
        action: "PASSWORD_RESET_REQUESTED",
        note: "Password reset link emailed to the customer",
      });
    } catch (error) {
      console.error("[api/auth/forgot-password] failed to send reset email", describeError(error));
    }
  }

  return jsonSuccess({ message: GENERIC_MESSAGE });
}
