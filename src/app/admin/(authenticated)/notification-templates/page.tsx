import type { Metadata } from "next";
import { NotificationTemplatesManager } from "@/components/admin/NotificationTemplatesManager";

export const metadata: Metadata = { title: "Notification Templates | Admin" };

export default function AdminNotificationTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Notification Templates</h1>
        <p className="text-sm text-ink-tertiary">
          Editable WhatsApp and Email copy per event, with {"{{placeholder}}"} variables. EMAIL templates are live —
          the events below actually send via Resend (or log to the server console until a real API key is
          configured). WhatsApp sending isn&apos;t wired up yet. Use &quot;Send Test&quot; on an EMAIL template to
          verify it with sample data before relying on a real trigger.
        </p>
      </div>
      <NotificationTemplatesManager />
    </div>
  );
}
