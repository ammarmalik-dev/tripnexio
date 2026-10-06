import crypto from "crypto";
import { getEmailSender } from "../email/get-sender";
import { escapeHtml } from "../html/escape";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A 14-character random password (no look-alike characters), from the OS crypto source. */
export function generateTemporaryPassword(length = 14): string {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let index = 0; index < length; index += 1) password += ALPHABET[bytes[index] % ALPHABET.length];
  return password;
}

/**
 * Client corrections 2026-10-05 — after Admin creates a staff account, the
 * login details go to the staff member's official email automatically. The
 * password is temporary: the email asks them to change it right away (My
 * Profile → Change password). Never logged or stored in plain text.
 */
export async function sendStaffWelcomeEmail(input: { to: string; name: string; roleName: string; temporaryPassword: string; loginUrl: string }): Promise<void> {
  await getEmailSender().send({
    to: input.to,
    subject: "Your TripNexio Internal Dashboard login",
    html: `<p>Hi ${escapeHtml(input.name)},</p>
<p>An account has been created for you on the TripNexio Internal Dashboard with the role <strong>${escapeHtml(input.roleName)}</strong>.</p>
<p><strong>Login page:</strong> <a href="${escapeHtml(input.loginUrl)}">${escapeHtml(input.loginUrl)}</a><br>
<strong>Email:</strong> ${escapeHtml(input.to)}<br>
<strong>Temporary password:</strong> <code style="font-size:15px;background:#EEF3FC;padding:2px 6px;border-radius:4px">${escapeHtml(input.temporaryPassword)}</code></p>
<p>Please sign in and change this password straight away from <strong>My Profile → Change password</strong>. Don't share it with anyone.</p>`,
  });
}
