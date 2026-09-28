import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { resetPasswordSchema } from "@/lib/validation/reset-password-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { clientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { consumeCustomerPasswordResetToken } from "@/lib/auth/customer-password-reset";
import { writeAudit } from "@/lib/audit/log";

/** P09 — sets a customer's new password from an emailed link (30 minutes, single use); every other outstanding link is voided. */
export async function POST(request: NextRequest) {
  if (await isRateLimited(`customer-reset-password:${clientIp(request)}`)) {
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

  const customerId = await consumeCustomerPasswordResetToken(parsed.data.token);
  if (!customerId) {
    return jsonError(400, "This reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.$transaction(async (tx) => {
    await tx.customer.update({ where: { id: customerId }, data: { passwordHash } });
    await tx.customerPasswordResetToken.updateMany({ where: { customerId, usedAt: null }, data: { usedAt: new Date() } });
    await writeAudit(tx, {
      entityType: "Customer",
      entityId: customerId,
      action: "PASSWORD_RESET_COMPLETED",
      note: "Password reset via emailed link; other reset links revoked",
    });
  });

  return jsonSuccess({ message: "Your password has been reset. You can now sign in." });
}
