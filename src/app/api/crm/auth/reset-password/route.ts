import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { resetPasswordSchema } from "@/lib/validation/reset-password-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { isRateLimited } from "@/lib/auth/rate-limit";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { writeAudit } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`reset-password:${ip}`)) {
    return jsonError(429, "Too many attempts. Please try again later.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const userId = await consumePasswordResetToken(parsed.data.token);
  if (!userId) {
    return jsonError(400, "This reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await writeAudit(tx, {
      entityType: "User",
      entityId: userId,
      action: "PASSWORD_RESET_COMPLETED",
      note: "Password reset via emailed link",
    });
  });

  return jsonSuccess({ message: "Your password has been reset. You can now sign in." });
}
