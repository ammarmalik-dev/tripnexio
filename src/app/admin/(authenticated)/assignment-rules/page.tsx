import type { Metadata } from "next";
import { AssignmentRulesManager } from "@/components/admin/AssignmentRulesManager";

export const metadata: Metadata = { title: "Assignment Rules | Admin" };

/** P24 item 3 — the API (/api/admin/assignment-rules) enforces staff.manage server-side. */
export default function AdminAssignmentRulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Assignment Rules</h1>
        <p className="text-sm text-ink-tertiary">
          Narrow who auto-assign can pick for a service (or one sub-service): only staff on a given role, and only
          while they have fewer open leads than the limit. Rules are tried highest priority first; the first rule
          with an available staff member wins, and the lowest PAX workload among them gets the lead. If rules exist
          but nobody qualifies, the lead stays unassigned. With no rules, the roster and workload decide as before.
          Staff with countries set under Staff only receive leads for those destination countries.
        </p>
      </div>
      <AssignmentRulesManager />
    </div>
  );
}
