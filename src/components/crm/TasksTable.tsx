"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RotateCw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TaskStatusControl } from "./TaskStatusControl";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskAssignmentControl } from "./TaskAssignmentControl";
import { TASK_STATUS_OPTIONS, TASK_TYPE_OPTIONS, TASK_PRIORITY_OPTIONS, TASK_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { TaskStatus, TaskType, TaskPriority, ServiceType } from "../../generated/prisma/enums";

interface TaskListItem {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  reason: string | null;
  serviceType: ServiceType | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  leadReferenceId: string | null;
  booking: { id: string; bookingId: string } | null;
  passenger: { id: string; fullName: string } | null;
  assignedTo: { id: string; name: string } | null;
}

interface TaskListResponse {
  items: TaskListItem[];
  total: number;
}

type SortOption = "createdAt_desc" | "createdAt_asc" | "dueDate_asc";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function TasksTable() {
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [assigneeOverrides, setAssigneeOverrides] = useState<Record<string, { id: string; name: string } | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (priority) params.set("priority", priority);
        params.set("sort", sort);

        const result = await getJson<TaskListResponse>(`/api/tasks?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setStatusOverrides({});
        setAssigneeOverrides({});
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load tasks. Please try again.");
        setState("error");
      }
    }

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [status, type, priority, sort, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filter-task-type" className="sr-only">
          Filter by task type
        </label>
        <select
          id="filter-task-type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[180px]")}
        >
          <option value="">All task types</option>
          {TASK_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-task-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-task-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]")}
        >
          <option value="">All statuses</option>
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-task-priority" className="sr-only">
          Filter by priority
        </label>
        <select
          id="filter-task-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All priorities</option>
          {TASK_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="sort-tasks" className="sr-only">
          Sort tasks
        </label>
        <select
          id="sort-tasks"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[160px]")}
        >
          <option value="createdAt_desc">Newest first</option>
          <option value="createdAt_asc">Oldest first</option>
          <option value="dueDate_asc">Due soonest</option>
        </select>

        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setRefreshNonce((current) => current + 1)}
          disabled={state === "loading"}
        >
          <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load tasks"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setRefreshNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && items.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title="No tasks match these filters"
          description="Tasks are created automatically — e.g. when a document is flagged missing, an OCR extraction needs review, or a quote is about to expire."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Linked to</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {items.map((task) => (
                <tr key={task.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-primary">{task.title}</div>
                    <div className="text-xs text-ink-tertiary">
                      {TASK_TYPE_LABELS[task.type]}
                      {task.reason ? ` — ${task.reason}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-tertiary">
                    {task.booking ? (
                      <Link href="/crm/bookings" className="text-ink-accent hover:underline">
                        {task.booking.bookingId}
                      </Link>
                    ) : null}
                    {task.leadReferenceId ? <div>{task.leadReferenceId}</div> : null}
                    {task.passenger ? <div>{task.passenger.fullName}</div> : null}
                    {!task.booking && !task.leadReferenceId && !task.passenger ? "—" : null}
                  </td>
                  <td className="px-4 py-3">
                    <TaskPriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <TaskAssignmentControl
                      taskId={task.id}
                      assignedTo={assigneeOverrides[task.id] !== undefined ? assigneeOverrides[task.id] : task.assignedTo}
                      onChanged={(staff) => setAssigneeOverrides((current) => ({ ...current, [task.id]: staff }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusControl
                      taskId={task.id}
                      status={statusOverrides[task.id] ?? task.status}
                      onChanged={(next) => setStatusOverrides((current) => ({ ...current, [task.id]: next }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(task.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} task{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
