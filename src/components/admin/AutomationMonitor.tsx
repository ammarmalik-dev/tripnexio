"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

type RunStatus = "SUCCESS" | "FAILURE";

interface RunData {
  id: string;
  workflowKey: string;
  status: RunStatus;
  summary: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
}

interface WorkflowData {
  key: string;
  label: string;
  intendedSchedule: string;
  endpoint: string;
  lastRun: RunData | null;
}

interface AutomationData {
  workflows: WorkflowData[];
  recentRuns: RunData[];
}

type FetchState = "loading" | "success" | "error";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: RunStatus | "NEVER_RUN" }) {
  if (status === "NEVER_RUN") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs font-medium text-ink-tertiary">
        <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
        Never run
      </span>
    );
  }
  const isSuccess = status === "SUCCESS";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        isSuccess ? "bg-success/10 text-success" : "bg-error/10 text-error"
      )}
    >
      {isSuccess ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      {isSuccess ? "Success" : "Failure"}
    </span>
  );
}

function summaryText(summary: Record<string, unknown> | null): string {
  if (!summary) return "";
  return Object.entries(summary)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

function WorkflowCard({ workflow }: { workflow: WorkflowData }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-heading">{workflow.label}</p>
          <p className="text-xs text-ink-tertiary">{workflow.intendedSchedule}</p>
        </div>
        <StatusBadge status={workflow.lastRun?.status ?? "NEVER_RUN"} />
      </div>
      <code className="w-fit rounded bg-ink-primary/[0.04] px-1.5 py-0.5 text-xs text-ink-secondary">POST {workflow.endpoint}</code>
      {workflow.lastRun ? (
        <div className="mt-1 flex flex-col gap-1 text-xs text-ink-tertiary">
          <span>Last run: {formatDateTime(workflow.lastRun.startedAt)}</span>
          {workflow.lastRun.status === "SUCCESS" ? (
            <span>{summaryText(workflow.lastRun.summary)}</span>
          ) : (
            <span className="text-error">{workflow.lastRun.errorMessage}</span>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-tertiary">No runs recorded yet — this workflow hasn&apos;t been triggered by n8n.</p>
      )}
    </div>
  );
}

export function AutomationMonitor() {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<AutomationData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<AutomationData>("/api/admin/automation-runs");
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load automation status. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load automation status"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.workflows.map((workflow) => (
          <WorkflowCard key={workflow.key} workflow={workflow} />
        ))}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-1 p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-heading">Recent Runs</h2>
        {data.recentRuns.length === 0 ? (
          <EmptyState title="No runs yet" description="Once n8n starts calling these endpoints, every run will show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-ink-tertiary">
                  <th className="pb-2 pr-4 font-medium">Workflow</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-hairline last:border-b-0">
                    <td className="py-2 pr-4 text-ink-primary">{run.workflowKey}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2 pr-4 text-ink-tertiary">{formatDateTime(run.startedAt)}</td>
                    <td className={cn("py-2 text-xs", run.status === "FAILURE" ? "text-error" : "text-ink-tertiary")}>
                      {run.status === "FAILURE" ? run.errorMessage : summaryText(run.summary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
