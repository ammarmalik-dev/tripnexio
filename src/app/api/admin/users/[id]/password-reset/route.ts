import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { sendPasswordResetEmail } from "@/lib/auth/send-password-reset-email";
import { siteConfig } from "@/lib/site-config";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * P24 item 6 — an admin (staff.manage) sends another staff member a
 * password reset email. Reuses the exact staff forgot-password flow:
 * `createPasswordResetToken` (sha256-hashed, 30-minute, single-use, older
 * unused links invalidated) + `sendPasswordResetEmail` pointing at
 * /crm/reset-password. The raw token only ever goes into the email — it is
 * never returned here. Rate-limited per admin and per target account.
 * Doesn't change the password or sign the user out by itself; that happens
 * when they redeem the link (the reset route bumps sessionVersion).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  if (
    (await isRateLimited(`admin-password-reset-actor:${session.id}`, { limit: 20, windowMs: 60 * 60 * 1000 })) ||
    (await isRateLimited(`admin-password-reset-target:${id}`, { limit: 3, windowMs: 60 * 60 * 1000 }))
  ) {
    return jsonError(429, "Too many reset emails. Please try again later.");
  }

  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, active: true } });
  if (!user) return jsonError(404, "Staff account not found.");
  if (!user.active) return jsonError(409, "This account is deactivated — reactivate it before sending a reset link.");

  try {
    const token = await createPasswordResetToken(user.id);
    const resetUrl = `${siteConfig.url}/crm/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);
    await writeAudit(db, {
      entityType: "User",
      entityId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      byUserId: session.id,
      note: `Password reset link emailed to ${user.email} by an admin (by ${session.name})`,
    });
    return jsonSuccess({ sent: true, email: user.email });
  } catch (error) {
    console.error("[api/admin/users/[id]/password-reset] failed to send reset email", describeError(error));
    return jsonError(502, "Couldn't send the reset email. Please try again.");
  }
}
