import type { Metadata } from "next";
import { TasksTable } from "@/components/crm/TasksTable";

export const metadata: Metadata = { title: "Tasks | CRM" };

export default function CrmTasksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Tasks</h1>
        <p className="text-sm text-ink-tertiary">
          Auto-created from a missing document, a pending OCR extraction, or a quote about to expire — see CRM.md §12.
        </p>
      </div>
      <TasksTable />
    </div>
  );
}
