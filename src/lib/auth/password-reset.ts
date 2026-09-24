import crypto from "crypto";
import { db } from "../db";

/** Chosen value — no client spec gave an exact number; 30 minutes matches common reset-link conventions. */
const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates the raw token that gets emailed to the user (never stored) and
 * persists only its sha256 hash, with a 30-minute expiry. Any of the
 * user's older unused tokens are left alone — each is independently
 * single-use and short-lived, so a stale one simply expires on its own;
 * no need to invalidate them here.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return token;
}

/**
 * Redeems a raw token: valid, unused, and unexpired only. Marks it used in
 * the same transaction as the check, so it can never be redeemed twice
 * (including two concurrent requests racing each other). Returns null for
 * any invalid/expired/already-used token — deliberately without
 * distinguishing which, same "never leak why" posture as staff login.
 */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  return db.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) return null;
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record.userId;
  });
}
