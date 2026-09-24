import type { NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/forgot-password-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail } from "@/lib/auth/send-password-reset-email";
import { writeAudit } from "@/lib/audit/log";
import { siteConfig } from "@/lib/site-config";

const GENERIC_MESSAGE = "If that email address belongs to a staff account, a password reset link has been sent.";

/**
 * Step 48 — same "never reveal whether the email exists" posture as
 * /api/crm/auth/login (see that route's own comment): this ALWAYS returns
 * 200 with the identical generic message, whether or not a matching
 * active user was found, and even when the per-email rate limit trips
 * (a distinct 429 there would itself confirm the address is a real,
 * actively-targeted account).
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`forgot-password-ip:${ip}`)) {
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
  if (isRateLimited(`forgot-password-email:${email}`)) {
    return jsonSuccess({ message: GENERIC_MESSAGE });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user && user.active) {
    try {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = `${siteConfig.url}/crm/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
      await writeAudit(db, {
        entityType: "User",
        entityId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        note: `Password reset link emailed to ${user.email}`,
      });
    } catch (error) {
      console.error("[api/crm/auth/forgot-password] failed to send reset email", error);
    }
  }

  return jsonSuccess({ message: GENERIC_MESSAGE });
}
