import { getEmailSender } from "../email/get-sender";

/**
 * Step 48 — a raw, non-template email (mirrors src/lib/automation/system-alert.ts's
 * pattern): this is a security-critical, one-off auth email, not a
 * customer-facing NotificationTemplate event. Unlike sendSystemAlert(),
 * this does NOT swallow its own errors — the caller (the forgot-password
 * route) decides how to handle a send failure; the HTTP response to the
 * client must stay identical either way (never leak whether the email
 * exists), but the route still needs to know if the send itself failed so
 * it can log it.
 */
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  await getEmailSender().send({
    to,
    subject: "Reset your TripNexio Internal Dashboard password",
    html: `<p>Hi ${name},</p>
<p>We received a request to reset your TripNexio staff password. Click the link below to choose a new one — this link expires in 30 minutes and can only be used once.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>`,
  });
}
