"use client";

import { useEffect, useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface StaffOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LeadAssignmentControlProps {
  leadId: string;
  assignedStaff: { id: string; name: string } | null;
  onChanged: (staff: { id: string; name: string } | null) => void;
  /**
   * CRM.md §34 / ADMIN.md §12: "normal CRM staff CANNOT assign/reassign...
   * Admin CAN." A staff member without leads.reassign can still claim an
   * unassigned lead (assignedStaff === null) but can't move a lead that's
   * already assigned to someone else — the server enforces this too (PATCH
   * /api/leads/[id]/assign), this is just the matching UI state.
   */
  canReassign: boolean;
}

export function LeadAssignmentControl({ leadId, assignedStaff, onChanged, canReassign }: LeadAssignmentControlProps) {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      try {
        const staff = await getJson<StaffOption[]>("/api/staff");
        if (!cancelled) setStaffOptions(staff);
      } catch {
        // The select just stays empty (besides Unassigned) — not worth a toast for a background list load.
      }
    }
    void loadStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = async (staffId: string) => {
    setPending(true);
    try {
      await patchJson(`/api/leads/${leadId}/assign`, { staffId: staffId || null });
      const staff = staffOptions.find((option) => option.id === staffId) ?? null;
      toast.success(staff ? `Assigned to ${staff.name}` : "Unassigned");
      onChanged(staff ? { id: staff.id, name: staff.name } : null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the assignment. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const canEditThisAssignment = assignedStaff === null || canReassign;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="lead-assign-select" className="text-xs font-medium text-ink-tertiary">
        Assigned to
      </label>
      {canEditThisAssignment ? (
        <select
          id="lead-assign-select"
          value={assignedStaff?.id ?? ""}
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
    </div>
  );
}
