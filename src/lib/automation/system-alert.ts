import { getSystemConfig } from "../settings/system-config";
import { getEmailSender } from "../email/get-sender";

/**
 * Step 45 (Admin FINAL handover §19, "system notifications") — staff/ops
 * alerting, deliberately separate from the customer-facing
 * NotificationTemplate/notifyCustomer() system (Phase 5B/5C): there's no
 * template to render here, just a raw plaintext alert to whoever Admin has
 * set as SystemConfig.systemAlertEmail. Never throws — an alert about a
 * failure must never itself become a second failure that masks the first
 * (see record-run.ts, which calls this right before re-throwing the
 * original error).
 */
export async function sendSystemAlert(subject: string, body: string): Promise<void> {
  try {
    const { systemAlertEmail } = await getSystemConfig();
    if (!systemAlertEmail) return;

    await getEmailSender().send({
      to: systemAlertEmail,
      subject: `[TripNexio System Alert] ${subject}`,
      html: `<p>${body}</p>`,
    });
  } catch (error) {
    console.error("[automation/system-alert] couldn't send system alert", error);
  }
}
