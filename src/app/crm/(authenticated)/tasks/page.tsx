import type { Metadata } from "next";
import { TasksTable } from "@/components/crm/TasksTable";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Tasks | Internal Dashboard" };

export default async function CrmTasksPage() {
  const session = await getStaffSession();
  // UI courtesy only — POST /api/tasks enforces tasks.edit itself.
  const canCreate = hasPermission(session, "tasks.edit");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Tasks</h1>
        <p className="text-sm text-ink-tertiary">
          Auto-created from a missing document, a pending OCR extraction, or a quote about to expire — plus manual tasks and Help-page support requests.
        </p>
      </div>
      <TasksTable canCreate={canCreate} />
    </div>
  );
}
