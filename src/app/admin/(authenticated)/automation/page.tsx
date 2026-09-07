import type { Metadata } from "next";
import { AutomationMonitor } from "@/components/admin/AutomationMonitor";

export const metadata: Metadata = { title: "Automation | Admin" };

export default function AdminAutomationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Automation</h1>
        <p className="text-sm text-ink-tertiary">
          Background workflows run by n8n — quote expiry handling, payment follow-up reminders, OTB requirement checks, and periodic
          service follow-ups. See <code className="rounded bg-ink-primary/[0.04] px-1 py-0.5">AUTOMATION_WORKFLOWS.md</code> for what
          each one does and how to set it up in n8n.
        </p>
      </div>
      <AutomationMonitor />
    </div>
  );
}
