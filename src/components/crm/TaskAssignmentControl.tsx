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

interface TaskAssignmentControlProps {
  taskId: string;
  assignedTo: { id: string; name: string } | null;
  onChanged: (staff: { id: string; name: string } | null) => void;
}

export function TaskAssignmentControl({ taskId, assignedTo, onChanged }: TaskAssignmentControlProps) {
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
      await patchJson(`/api/tasks/${taskId}/assign`, { assignedToId: staffId || null });
      const staff = staffOptions.find((option) => option.id === staffId) ?? null;
      toast.success(staff ? `Assigned to ${staff.name}` : "Unassigned");
      onChanged(staff ? { id: staff.id, name: staff.name } : null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the assignment. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`task-assign-select-${taskId}`} className="sr-only">
        Assign task
      </label>
      <select
        id={`task-assign-select-${taskId}`}
        value={assignedTo?.id ?? ""}
        disabled={pending}
        onChange={(event) => void handleChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[160px] text-sm")}
      >
        <option value="">Unassigned</option>
        {staffOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
