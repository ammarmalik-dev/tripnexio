import { cn } from "@/lib/cn";
import { TASK_PRIORITY_LABELS } from "@/lib/crm/labels";
import type { TaskPriority } from "../../generated/prisma/enums";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "bg-ink-primary/[0.06] text-ink-tertiary",
  NORMAL: "bg-ink-primary/[0.06] text-ink-secondary",
  HIGH: "bg-warning/10 text-warning",
  URGENT: "bg-error/10 text-error",
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        PRIORITY_STYLES[priority]
      )}
    >
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}
