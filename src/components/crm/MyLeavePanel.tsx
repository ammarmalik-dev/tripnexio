"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { LeaveStatusBadge } from "@/components/crm/LeaveStatusBadge";
import { LEAVE_TYPE_OPTIONS, LEAVE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { LeaveStatus, LeaveType } from "../../generated/prisma/enums";

interface MyLeaveData {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  type: LeaveType;
  approvedBy: { id: string; name: string } | null;
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function RequestLeaveForm({ onCreated }: { onCreated: (leave: MyLeaveData) => void }) {
  const [type, setType] = useState<LeaveType | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<MyLeaveData>("/api/staff-leave", {
        type,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      toast.success("Leave request submitted — awaiting approval.");
      onCreated(created);
      setType("");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't submit this leave request. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = type && startDate && endDate;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Request Leave</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Type" htmlFor="my-leave-type" error={errors.type?.[0]}>
          <select
            id="my-leave-type"
            value={type}
            disabled={creating}
            onChange={(event) => setType(event.target.value as LeaveType)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.type))}
          >
            <option value="" disabled>
              Select a type
            </option>
            {LEAVE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <TextField
          label="Reason"
          name="reason"
          placeholder="Optional"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={creating}
        />
        <TextField
          label="Start Date"
          name="startDate"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          error={errors.startDate?.[0]}
          disabled={creating}
        />
        <TextField
          label="End Date"
          name="endDate"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          error={errors.endDate?.[0]}
          disabled={creating}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit Request
        </Button>
      </div>
    </div>
  );
}

function LeaveRow({ leave }: { leave: MyLeaveData }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <LeaveStatusBadge status={leave.status} />
          <span className="rounded-full bg-ink-primary/[0.04] px-2 py-0.5 text-xs text-ink-tertiary">{LEAVE_TYPE_LABELS[leave.type]}</span>
        </div>
        <span className="text-xs text-ink-tertiary">
          {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
          {leave.reason ? ` · ${leave.reason}` : ""}
          {leave.approvedBy ? ` · ${leave.status === "APPROVED" ? "Approved" : "Rejected"} by ${leave.approvedBy.name}` : ""}
        </span>
      </div>
    </div>
  );
}

export function MyLeavePanel() {
  const [state, setState] = useState<FetchState>("loading");
  const [leaves, setLeaves] = useState<MyLeaveData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<MyLeaveData[]>("/api/staff-leave");
        if (cancelled) return;
        setLeaves(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load your leave requests. Please try again.");
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
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load your leave requests"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {leaves.length === 0 ? (
        <EmptyState title="No leave requested yet" description="Submit your first request using the form below." />
      ) : (
        leaves.map((leave) => <LeaveRow key={leave.id} leave={leave} />)
      )}
      <RequestLeaveForm onCreated={(created) => setLeaves((current) => [created, ...current])} />
    </div>
  );
}
