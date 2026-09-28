import { getEmailSender } from "../email/get-sender";
import { escapeHtml } from "../html/escape";

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
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>We received a request to reset your TripNexio staff password. Click the link below to choose a new one — this link expires in 30 minutes and can only be used once.</p>
<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
<p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>`,
  });
}

/** P09 — the customer-account version of the reset email. Same raw, non-template approach and error behaviour as the staff one above. */
export async function sendCustomerPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  await getEmailSender().send({
    to,
    subject: "Reset your TripNexio password",
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>We received a request to reset the password for your TripNexio account. Click the link below to choose a new one — this link expires in 30 minutes and can only be used once.</p>
<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
<p>If you didn't request this, you can safely ignore this email — your password will not be changed.</p>`,
  });
}
