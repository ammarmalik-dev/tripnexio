import type { Metadata } from "next";
import { NotificationTemplatesManager } from "@/components/admin/NotificationTemplatesManager";

export const metadata: Metadata = { title: "Notification Templates | Admin" };

export default function AdminNotificationTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Notification Templates</h1>
        <p className="text-sm text-ink-tertiary">
          Editable WhatsApp and Email copy per event, with {"{{placeholder}}"} variables. No notification system sends
          these yet (Phase 5) — this is the configuration layer for when it does. A couple of clearly-labeled SAMPLE
          templates are seeded for development.
        </p>
      </div>
      <NotificationTemplatesManager />
    </div>
  );
}
