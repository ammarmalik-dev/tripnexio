import type { Metadata } from "next";
import { SystemConfigManager } from "@/components/admin/SystemConfigManager";

export const metadata: Metadata = { title: "System Configuration | Admin" };

export default function AdminSystemConfigPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">System Configuration</h1>
        <p className="text-sm text-ink-tertiary">
          Company info, branding, currency, timezone, data retention, backup reference, maintenance mode and system alerts.
          API keys and other secrets stay in environment variables — never here.
        </p>
      </div>
      <SystemConfigManager />
    </div>
  );
}
