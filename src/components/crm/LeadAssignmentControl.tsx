"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
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
}

export function LeadAssignmentControl({ leadId, serviceType, assignedStaff, onChanged, canReassign }: LeadAssignmentControlProps) {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<AssignmentSuggestion | null>(null);

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

  const handleChange = async (staffId: string) => {
    setPending(true);
    try {
      await patchJson(`/api/leads/${leadId}/assign`, { staffId: staffId || null });
      const staff = staffOptions.find((option) => option.id === staffId) ?? null;
      toast.success(staff ? `Assigned to ${staff.name}` : "Unassigned");
      // The roster dropdown only ever offers active, roster-eligible staff — see GET /api/staff?service=.
      onChanged(staff ? { id: staff.id, name: staff.name, active: true } : null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the assignment. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const canEditThisAssignment = effectivelyUnassigned || canReassign;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="lead-assign-select" className="text-xs font-medium text-ink-tertiary">
          Assigned to
        </label>
        {canEditThisAssignment ? (
          <select
            id="lead-assign-select"
            value={effectivelyUnassigned ? "" : (assignedStaff?.id ?? "")}
            disabled={pending}
            onChange={(event) => void handleChange(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[180px] text-sm")}
          >
            <option value="">Unassigned</option>
            {staffOptions.map((option) => (
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

      {effectivelyUnassigned && suggestion ? (
        <div className="flex items-center gap-2 text-xs text-ink-tertiary">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-accent" aria-hidden="true" />
          <span>
            Suggested: <span className="font-medium text-ink-secondary">{suggestion.name}</span> ({suggestion.paxCount} PAX across{" "}
            {suggestion.openBookingCount} open booking{suggestion.openBookingCount === 1 ? "" : "s"})
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => void handleChange(suggestion.staffId)}>
            Assign to {suggestion.name.split(" ")[0]}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
