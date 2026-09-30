import type { Metadata } from "next";
import { EscalationRulesManager } from "@/components/admin/EscalationRulesManager";

export const metadata: Metadata = { title: "SLA Escalation | Admin" };

/** P24 item 3 — the API (/api/admin/escalation-rules) enforces staff.manage server-side. */
export default function AdminEscalationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">SLA Escalation</h1>
        <p className="text-sm text-ink-tertiary">
          When an open booking stays in a status longer than the hours set here (counted from its last status
          change), the hourly SLA Escalation automation notifies managers or admins who can see that service and
          records it on the booking. Each booking is escalated once per rule for each stay in a status.
        </p>
      </div>
      <EscalationRulesManager />
    </div>
  );
}
