import type { Metadata } from "next";
import { NotificationTemplatesManager } from "@/components/admin/NotificationTemplatesManager";

export const metadata: Metadata = { title: "Notification Templates | Admin" };

export default function AdminNotificationTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Notification Templates</h1>
        <p className="text-sm text-ink-tertiary">
          The Email and WhatsApp messages customers receive, grouped by service (each status of a service sends its own
          template) plus the general / system messages shared by every service. Edit the copy with {"{{placeholder}}"}
          variables and use &quot;Send Test&quot; to check it with sample data. Retired templates are no longer sent and
          are hidden unless you tick &quot;Show retired templates&quot;.
        </p>
      </div>
      <NotificationTemplatesManager />
    </div>
  );
}
