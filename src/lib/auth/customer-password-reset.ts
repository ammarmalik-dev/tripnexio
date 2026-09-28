import crypto from "crypto";
import { db } from "../db";

/** 30 minutes, single use — same rules as the staff reset link (src/lib/auth/password-reset.ts). */
const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Emails-only raw token (never stored); only its hash is saved. Any older unused link for this customer stops working. */
export async function createCustomerPasswordResetToken(customerId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.$transaction([
    db.customerPasswordResetToken.updateMany({ where: { customerId, usedAt: null }, data: { usedAt: new Date() } }),
    db.customerPasswordResetToken.create({
      data: { customerId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);
  return token;
}

/** Redeems a token once (valid, unused, unexpired) and returns the customer id, or null — never says why. */
export async function consumeCustomerPasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  return db.$transaction(async (tx) => {
    const record = await tx.customerPasswordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) return null;
    await tx.customerPasswordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record.customerId;
  });
}
