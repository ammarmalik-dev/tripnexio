import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { changePasswordSchema } from "@/lib/validation/staff-profile-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";
import { rateLimitByIp, isRateLimited } from "@/lib/auth/rate-limit";
import { createStaffSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/session";

/**
 * P22 item 5 — CRM.md §31 Change Password. Verifies the current password,
 * stores a bcrypt hash of the new one (same cost as the seed/admin/reset
 * paths), and bumps User.sessionVersion so every OTHER session is signed
 * out — then re-issues this browser's cookie at the new version so the
 * person making the change stays signed in.
 */
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const limited = await rateLimitByIp(request, "staff-change-password", { limit: 10 }, "Too many attempts. Please try again later.");
  if (limited) return limited;
  if (await isRateLimited(`staff-change-password-user:${session.id}`, { limit: 5 })) {
    return jsonError(429, "Too many attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const user = await db.user.findUnique({ where: { id: session.id }, select: { passwordHash: true } });
    if (!user) return jsonError(401, "Sign in required.");

    const currentMatches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!currentMatches) {
      return jsonError(400, "Your current password is incorrect.", { currentPassword: ["Your current password is incorrect."] });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: session.id },
        data: { passwordHash, sessionVersion: { increment: 1 } },
        select: { id: true, email: true, name: true, sessionVersion: true },
      });
      // Any outstanding emailed reset link would otherwise still work after the change.
      await tx.passwordResetToken.updateMany({ where: { userId: session.id, usedAt: null }, data: { usedAt: new Date() } });
      await writeAudit(tx, {
        entityType: "User",
        entityId: session.id,
        action: "PASSWORD_CHANGED",
        byUserId: session.id,
        note: `Password changed from the CRM Profile page; other sessions signed out (by ${session.name})`,
      });
      return result;
    });

    const token = await createStaffSessionToken({
      sub: updated.id,
      email: updated.email,
      name: updated.name,
      role: session.role,
      sessionVersion: updated.sessionVersion,
    });

    const response = jsonSuccess({ message: "Password changed. Other devices have been signed out." });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("[profile-password] failed", error instanceof Error ? error.message : "unknown");
    return jsonError(500, "Couldn't change your password. Please try again.");
  }
}
