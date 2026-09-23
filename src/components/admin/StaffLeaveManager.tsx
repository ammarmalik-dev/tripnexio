"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { LeaveStatusBadge } from "@/components/crm/LeaveStatusBadge";
import { LEAVE_TYPE_OPTIONS, LEAVE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { LeaveStatus, LeaveType } from "../../generated/prisma/enums";

interface StaffOption {
  id: string;
  name: string;
}

interface StaffLeaveData {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  type: LeaveType;
  user: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isCurrentlyOnLeave(leave: StaffLeaveData): boolean {
  if (leave.status !== "APPROVED") return false;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(leave.startDate) <= today && today <= new Date(leave.endDate);
}

function NewLeaveForm({ staffOptions, onCreated }: { staffOptions: StaffOption[]; onCreated: (leave: StaffLeaveData) => void }) {
  const [userId, setUserId] = useState("");
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
      const created = await postJson<StaffLeaveData>("/api/admin/staff-leave", {
        userId,
        type,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      toast.success(`Leave recorded for ${created.user.name}.`);
      onCreated(created);
      setUserId("");
      setType("");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't record this leave. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = userId && type && startDate && endDate;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Leave</h2>
      <p className="text-xs text-ink-tertiary">
        Recorded here directly by Admin — this is created already Approved, not a request awaiting a decision.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Staff Member" htmlFor="staff-leave-user" error={errors.userId?.[0]}>
          <select
            id="staff-leave-user"
            value={userId}
            disabled={creating}
            onChange={(event) => setUserId(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.userId))}
          >
            <option value="" disabled>
              Select a staff member
            </option>
            {staffOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Type" htmlFor="staff-leave-type" error={errors.type?.[0]}>
          <select
            id="staff-leave-type"
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
          <Plus className="h-4 w-4" aria-hidden="true" />
          Record Leave
        </Button>
      </div>
    </div>
  );
}

function LeaveRow({
  leave,
  canApprove,
  onDeleted,
  onDecided,
}: {
  leave: StaffLeaveData;
  canApprove: boolean;
  onDeleted: (id: string) => void;
  onDecided: (leave: StaffLeaveData) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const onLeaveNow = isCurrentlyOnLeave(leave);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteJson(`/api/admin/staff-leave/${leave.id}`);
      toast.success("Leave record removed.");
      onDeleted(leave.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this leave record. Please try again.");
      setDeleting(false);
    }
  };

  const handleDecide = async (status: "APPROVED" | "REJECTED") => {
    setDeciding(true);
    try {
      const updated = await patchJson<StaffLeaveData>(`/api/admin/staff-leave/${leave.id}/status`, { status });
      toast.success(status === "APPROVED" ? "Leave approved." : "Leave rejected.");
      onDecided(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this leave request. Please try again.");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink-primary">{leave.user.name}</span>
          <LeaveStatusBadge status={leave.status} />
          <span className="rounded-full bg-ink-primary/[0.04] px-2 py-0.5 text-xs text-ink-tertiary">{LEAVE_TYPE_LABELS[leave.type]}</span>
          {onLeaveNow ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">On leave now</span> : null}
        </div>
        <span className="text-xs text-ink-tertiary">
          {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
          {leave.reason ? ` · ${leave.reason}` : ""}
          {leave.approvedBy ? ` · ${leave.status === "APPROVED" ? "Approved" : "Rejected"} by ${leave.approvedBy.name}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {leave.status === "PENDING" && canApprove ? (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleDecide("APPROVED")} isLoading={deciding}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleDecide("REJECTED")} isLoading={deciding}>
              <X className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </>
        ) : leave.status === "PENDING" ? (
          <span className="text-xs text-ink-tertiary">Awaiting approval</span>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </Button>
      </div>
    </div>
  );
}

/**
 * Step 26 Unit 3 (audit §3.11/§4.7) — ADMIN.md §13's roster/leave screen.
 * Step 38 added the approval workflow: a leave recorded directly here is
 * created already Approved (Admin's own action is the decision); a
 * staff-requested one (from /crm/my-leave) shows up here as Pending until
 * someone with staff.leave.approve decides it. Dates/reason/type stay
 * create+delete-only otherwise — no inline edit of an already-decided
 * leave's period.
 */
export function StaffLeaveManager({ canApprove }: { canApprove: boolean }) {
  const [state, setState] = useState<FetchState>("loading");
  const [leaves, setLeaves] = useState<StaffLeaveData[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [leaveResult, staffResult] = await Promise.all([
          getJson<StaffLeaveData[]>("/api/admin/staff-leave"),
          getJson<StaffOption[]>("/api/staff"),
        ]);
        if (cancelled) return;
        setLeaves(leaveResult);
        setStaffOptions(staffResult);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load staff leave. Please try again.");
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
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load staff leave"
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
        <EmptyState title="No leave recorded yet" description="Record the first one using the form below." />
      ) : (
        leaves.map((leave) => (
          <LeaveRow
            key={leave.id}
            leave={leave}
            canApprove={canApprove}
            onDeleted={(id) => setLeaves((current) => current.filter((entry) => entry.id !== id))}
            onDecided={(updated) => setLeaves((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewLeaveForm staffOptions={staffOptions} onCreated={(created) => setLeaves((current) => [created, ...current])} />
    </div>
  );
}
