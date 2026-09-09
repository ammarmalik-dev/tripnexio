"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TASK_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextTaskStatuses } from "@/lib/tasks/transitions";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { TaskStatus } from "../../generated/prisma/enums";

interface TaskStatusControlProps {
  taskId: string;
  status: TaskStatus;
  onChanged: (status: TaskStatus) => void;
}

export function TaskStatusControl({ taskId, status, onChanged }: TaskStatusControlProps) {
  const [pending, setPending] = useState(false);
  const nextStatuses = getAllowedNextTaskStatuses(status);

  const handleChange = async (nextStatus: string) => {
    if (!nextStatus || nextStatus === status) return;
    setPending(true);
    try {
      await patchJson(`/api/tasks/${taskId}/status`, { status: nextStatus });
      toast.success(`Task marked ${TASK_STATUS_LABELS[nextStatus as TaskStatus]}`);
      onChanged(nextStatus as TaskStatus);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the task status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <TaskStatusBadge status={status} />
      {nextStatuses.length === 0 ? (
        <span className="text-xs text-ink-tertiary">Final status</span>
      ) : (
        <>
          <label htmlFor={`task-status-select-${taskId}`} className="sr-only">
            Change task status
          </label>
          <select
            id={`task-status-select-${taskId}`}
            value=""
            disabled={pending}
            onChange={(event) => void handleChange(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[150px] text-sm")}
          >
            <option value="" disabled>
              Move to…
            </option>
            {nextStatuses.map((next) => (
              <option key={next} value={next}>
                {TASK_STATUS_LABELS[next]}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
