"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { REASSIGN_REASON_MIN_LENGTH } from "@/lib/validation/lead-assign-schema";
import type { ServiceType } from "../../generated/prisma/enums";

interface StaffOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AssignmentSuggestion {
  staffId: string;
  name: string;
  paxCount: number;
  openBookingCount: number;
  openLeadCount: number;
}

interface LeadAssignmentControlProps {
  leadId: string;
  /** Step 39 — only staff scoped for this service (or unrestricted) are offered, both in the dropdown and the suggestion. */
  serviceType: ServiceType;
  /** Step 50 — `active` is the assignee's current status, not the lead's; a `false` here is what makes this lead "effectively unassigned". */
  assignedStaff: { id: string; name: string; active: boolean } | null;
  onChanged: (staff: { id: string; name: string; active: boolean } | null) => void;
  /**
   * CRM.md §34 / ADMIN.md §12: "normal CRM staff CANNOT assign/reassign...
   * Admin CAN." A staff member without leads.reassign can still claim an
   * unassigned lead (assignedStaff === null) but can't move a lead that's
   * already assigned to someone else — the server enforces this too (PATCH
   * /api/leads/[id]/assign), this is just the matching UI state.
   */
  canReassign: boolean;
  /** Staff without leads.reassign may only take an unassigned lead themselves (client corrections 2026-10-05). */
  currentStaffId: string;
}

export function LeadAssignmentControl({ leadId, serviceType, assignedStaff, onChanged, canReassign, currentStaffId }: LeadAssignmentControlProps) {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<AssignmentSuggestion | null>(null);
  // P22 item 8 — a change away from an existing assignee is staged here
  // until the Admin gives a reason ("" = unassign; null = nothing staged).
  const [pendingStaffId, setPendingStaffId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      try {
        const staff = await getJson<StaffOption[]>(`/api/staff?service=${serviceType}`);
        if (!cancelled) setStaffOptions(staff);
      } catch {
        // The select just stays empty (besides Unassigned) — not worth a toast for a background list load.
      }
    }
    void loadStaff();
    return () => {
      cancelled = true;
    };
  }, [serviceType]);

  // Step 50 (Internal Dashboard Merged §2) — a lead whose assignee has
  // gone inactive is treated as effectively unassigned: claimable by
  // anyone with leads.edit, and eligible for the auto-assign suggestion,
  // exactly like a lead that was never assigned at all.
  const effectivelyUnassigned = assignedStaff === null || !assignedStaff.active;

  // Step 26 Unit 2 (audit §3.11/§4.7) — only meaningful for an
  // effectively-unassigned lead; there's no "suggest a reassignment" case
  // here, only Admin's own deliberate bulk-reassignment flow (Unit 4)
  // covers moving already-assigned work.
  useEffect(() => {
    let cancelled = false;
    async function loadSuggestion() {
      if (!effectivelyUnassigned) {
        setSuggestion(null);
        return;
      }
      try {
        const result = await getJson<{ suggestion: AssignmentSuggestion | null }>(
          `/api/staff/suggest-assignment?service=${serviceType}`
        );
        if (!cancelled) setSuggestion(result.suggestion);
      } catch {
        // Non-critical background hint — the manual select still works without it.
      }
    }
    void loadSuggestion();
    return () => {
      cancelled = true;
    };
  }, [effectivelyUnassigned, serviceType]);

  const commitChange = async (staffId: string, changeReason?: string) => {
    setPending(true);
    try {
      await patchJson(`/api/leads/${leadId}/assign`, { staffId: staffId || null, reason: changeReason });
      const staff = staffOptions.find((option) => option.id === staffId) ?? null;
      toast.success(staff ? `Assigned to ${staff.name}` : "Unassigned");
      setPendingStaffId(null);
      setReason("");
      setReasonError("");
      // The roster dropdown only ever offers active, roster-eligible staff — see GET /api/staff?service=.
      onChanged(staff ? { id: staff.id, name: staff.name, active: true } : null);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.reason?.[0]) setReasonError(error.fieldErrors.reason[0]);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the assignment. Please try again.");
    } finally {
      setPending(false);
    }
  };

  // ADMIN.md §13 — "Manual reassignment should record a reason." Moving a
  // lead away from anyone it's already assigned to (active or not) needs
  // one; the server enforces the same rule (PATCH /api/leads/[id]/assign).
  const handleChange = (staffId: string) => {
    if (assignedStaff !== null && staffId !== assignedStaff.id) {
      setPendingStaffId(staffId);
      setReasonError("");
      return;
    }
    void commitChange(staffId);
  };

  const confirmReassignment = () => {
    if (pendingStaffId === null) return;
    const trimmed = reason.trim();
    if (trimmed.length < REASSIGN_REASON_MIN_LENGTH) {
      setReasonError(`Enter a reason of at least ${REASSIGN_REASON_MIN_LENGTH} characters.`);
      return;
    }
    void commitChange(pendingStaffId, trimmed);
  };

  const cancelReassignment = () => {
    setPendingStaffId(null);
    setReason("");
    setReasonError("");
  };

  const pendingTargetName =
    pendingStaffId === null ? null : pendingStaffId === "" ? "Unassigned" : (staffOptions.find((option) => option.id === pendingStaffId)?.name ?? "the selected staff member");

  const canEditThisAssignment = effectivelyUnassigned || canReassign;
  const pickableStaff = canReassign ? staffOptions : staffOptions.filter((option) => option.id === currentStaffId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="lead-assign-select" className="text-xs font-medium text-ink-tertiary">
          Assigned to
        </label>
        {canEditThisAssignment ? (
          <select
            id="lead-assign-select"
            value={pendingStaffId ?? (effectivelyUnassigned ? "" : (assignedStaff?.id ?? ""))}
            disabled={pending}
            onChange={(event) => handleChange(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[180px] text-sm")}
          >
            <option value="">Unassigned</option>
            {pickableStaff.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-ink-secondary" title="Only an Admin can reassign a lead that's already assigned.">
            {assignedStaff!.name} <span className="text-xs text-ink-tertiary">(Admin can reassign)</span>
          </span>
        )}
        {assignedStaff !== null && !assignedStaff.active ? (
          <span className="text-xs text-ink-tertiary" title="This lead's assignee is no longer active — it's treated as unassigned.">
            (was: {assignedStaff.name}, now inactive)
          </span>
        ) : null}
      </div>

      {pendingStaffId !== null ? (
        <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
          <label htmlFor="lead-reassign-reason" className="text-xs font-medium text-ink-secondary">
            Reason for moving this lead from {assignedStaff?.name ?? "its current assignee"} to {pendingTargetName}
          </label>
          <input
            id="lead-reassign-reason"
            type="text"
            value={reason}
            disabled={pending}
            maxLength={500}
            placeholder={`At least ${REASSIGN_REASON_MIN_LENGTH} characters — recorded in the audit trail`}
            aria-invalid={!!reasonError}
            aria-describedby={reasonError ? "lead-reassign-reason-error" : undefined}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmReassignment();
              }
            }}
            className={cn(fieldControlClass, fieldBorderClass(!!reasonError), "h-9 text-sm")}
          />
          {reasonError ? (
            <p id="lead-reassign-reason-error" className="text-xs text-error">
              {reasonError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancelReassignment}>
              Cancel
            </Button>
            <Button type="button" size="sm" isLoading={pending} onClick={confirmReassignment}>
              Confirm reassignment
            </Button>
          </div>
        </div>
      ) : null}

      {effectivelyUnassigned && suggestion && pendingStaffId === null && (canReassign || suggestion.staffId === currentStaffId) ? (
        <div className="flex items-center gap-2 text-xs text-ink-tertiary">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-accent" aria-hidden="true" />
          <span>
            Suggested: <span className="font-medium text-ink-secondary">{suggestion.name}</span> ({suggestion.paxCount} PAX across{" "}
            {suggestion.openLeadCount} open lead{suggestion.openLeadCount === 1 ? "" : "s"})
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => handleChange(suggestion.staffId)}>
            Assign to {suggestion.name.split(" ")[0]}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
