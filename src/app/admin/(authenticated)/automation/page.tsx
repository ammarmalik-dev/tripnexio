import type { Metadata } from "next";
import { AutomationMonitor } from "@/components/admin/AutomationMonitor";
import { IntegrationsHealth } from "@/components/admin/IntegrationsHealth";

export const metadata: Metadata = { title: "Automation | Admin" };

export default function AdminAutomationPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-heading">Integrations</h1>
          <p className="text-sm text-ink-tertiary">
            Connection health for each swappable external service — whether real credentials are configured or it&apos;s still running
            on a dev-only mock, plus the most recent successful call and error for each.
          </p>
        </div>
        <IntegrationsHealth />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-heading">Automation</h2>
          <p className="text-sm text-ink-tertiary">
            Background workflows run by n8n — quote expiry handling, payment follow-up reminders, OTB requirement checks, and periodic
            service follow-ups. See <code className="rounded bg-ink-primary/[0.04] px-1 py-0.5">AUTOMATION_WORKFLOWS.md</code> for what
            each one does and how to set it up in n8n.
          </p>
        </div>
        <AutomationMonitor />
      </div>
    </div>
  );
}
