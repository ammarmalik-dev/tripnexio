import { cn } from "@/lib/cn";
import { TASK_STATUS_LABELS } from "@/lib/crm/labels";
import type { TaskStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<TaskStatus, string> = {
  OPEN: "bg-ink-primary/[0.06] text-ink-secondary",
  IN_PROGRESS: "bg-accent/10 text-accent-on-light",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-error/10 text-error",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[11rem] items-center whitespace-normal break-words rounded-full px-2.5 py-1 text-center text-xs leading-tight font-medium",
        STATUS_STYLES[status]
      )}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
