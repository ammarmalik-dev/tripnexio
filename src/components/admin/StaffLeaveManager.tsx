"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

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
  user: { id: string; name: string };
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isCurrentlyOnLeave(leave: StaffLeaveData): boolean {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(leave.startDate) <= today && today <= new Date(leave.endDate);
}

function NewLeaveForm({ staffOptions, onCreated }: { staffOptions: StaffOption[]; onCreated: (leave: StaffLeaveData) => void }) {
  const [userId, setUserId] = useState("");
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
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      toast.success(`Leave recorded for ${created.user.name}.`);
      onCreated(created);
      setUserId("");
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

  const canSubmit = userId && startDate && endDate;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Leave</h2>
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

function LeaveRow({ leave, onDeleted }: { leave: StaffLeaveData; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-primary">{leave.user.name}</span>
          {onLeaveNow ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">On leave now</span> : null}
        </div>
        <span className="text-xs text-ink-tertiary">
          {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
          {leave.reason ? ` · ${leave.reason}` : ""}
        </span>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Remove
      </Button>
    </div>
  );
}

/**
 * Step 26 Unit 3 (audit §3.11/§4.7) — ADMIN.md §13's roster/leave screen.
 * Create + delete only (no inline edit) — a leave period is short-lived
 * reference data; correcting one is just as easy to remove and re-add, and
 * this keeps the screen simple per the "no complex weighting formula" /
 * keep-it-simple spirit of this whole locked rule.
 */
export function StaffLeaveManager() {
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
          <LeaveRow key={leave.id} leave={leave} onDeleted={(id) => setLeaves((current) => current.filter((entry) => entry.id !== id))} />
        ))
      )}
      <NewLeaveForm staffOptions={staffOptions} onCreated={(created) => setLeaves((current) => [created, ...current])} />
    </div>
  );
}
