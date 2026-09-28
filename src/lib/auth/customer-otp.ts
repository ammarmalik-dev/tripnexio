import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { getEmailSender } from "../email/get-sender";
import { escapeHtml } from "../html/escape";

export const GUEST_CLAIM_PURPOSE = "GUEST_CLAIM";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** "rahul@example.com" -> "r***@example.com" — shown to the customer so they know which inbox to check. */
export function maskEmailForDisplay(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? `${email.charAt(0)}***${email.slice(at)}` : "***";
}

/** Creates a fresh 6-digit code (older unused codes for the same purpose are voided) and emails it to `email`. */
export async function issueCustomerOtp(customerId: string, email: string, name: string, purpose = GUEST_CLAIM_PURPOSE): Promise<void> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);

  await db.$transaction([
    db.customerOtp.updateMany({ where: { customerId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.customerOtp.create({ data: { customerId, purpose, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) } }),
  ]);

  await getEmailSender().send({
    to: email,
    subject: "Your TripNexio verification code",
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>Your TripNexio verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>
<p>If you didn't try to create a TripNexio account, you can ignore this email.</p>`,
  });
}

export type VerifyOtpResult = "OK" | "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS";

/** Checks `code` against the customer's latest unused code for `purpose`; consumes it on success. */
export async function verifyCustomerOtp(customerId: string, code: string, purpose = GUEST_CLAIM_PURPOSE): Promise<VerifyOtpResult> {
  const otp = await db.customerOtp.findFirst({
    where: { customerId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return "INVALID";
  if (otp.expiresAt.getTime() < Date.now()) return "EXPIRED";
  if (otp.attempts >= MAX_ATTEMPTS) return "TOO_MANY_ATTEMPTS";

  const matches = /^\d{6}$/.test(code) && (await bcrypt.compare(code, otp.codeHash));
  if (!matches) {
    await db.customerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return otp.attempts + 1 >= MAX_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID";
  }

  const consumed = await db.customerOtp.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return consumed.count === 1 ? "OK" : "INVALID";
}
