"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface StatusOption {
  id: string;
  name: string;
}

interface StatusState {
  current: (StatusOption & { customerLabel: string | null; isTerminal: boolean }) | null;
  allowed: StatusOption[];
}

/**
 * CRM Change Status for a Lead or Booking (P08 — CRM.md §14): shows the
 * record's own per-service status and offers ONLY the next statuses Admin
 * configured for that service. The coarse badge stays alongside it.
 */
export function ServiceStatusControl<TCoarse extends string>({
  endpoint,
  badge,
  onChanged,
  selectId,
}: {
  /** e.g. /api/leads/<id>/status — GET lists the allowed next statuses, PATCH applies one. */
  endpoint: string;
  badge: ReactNode;
  onChanged: (coarseStatus: TCoarse) => void;
  selectId: string;
}) {
  const [state, setState] = useState<StatusState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<StatusState>(endpoint);
        if (!cancelled) {
          setState(result);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [endpoint, reloadNonce]);

  const handleChange = async (serviceStatusId: string) => {
    const target = state?.allowed.find((option) => option.id === serviceStatusId);
    if (!target) return;
    setPending(true);
    try {
      const updated = await patchJson<{ status: TCoarse }>(endpoint, { serviceStatusId });
      toast.success(`Status updated to ${target.name}`);
      onChanged(updated.status);
      setReloadNonce((n) => n + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {badge}
      {loadError ? (
        <button type="button" className="text-xs text-error underline" onClick={() => setReloadNonce((n) => n + 1)}>
          Couldn&apos;t load statuses — retry
        </button>
      ) : state === null ? (
        <Skeleton className="h-9 w-44" />
      ) : (
        <>
          {state.current ? <span className="text-sm font-medium text-ink-primary">{state.current.name}</span> : null}
          {state.allowed.length > 0 ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                Change status
              </label>
              <select
                id={selectId}
                value=""
                disabled={pending}
                onChange={(event) => void handleChange(event.target.value)}
                className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[180px] text-sm")}
              >
                <option value="" disabled>
                  Move to…
                </option>
                {state.allowed.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="text-xs text-ink-tertiary">Final status — no further transitions</span>
          )}
        </>
      )}
    </div>
  );
}
