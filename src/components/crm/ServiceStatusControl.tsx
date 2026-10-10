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
  customerLabel?: string | null;
}

interface StatusState {
  current: (StatusOption & { customerLabel: string | null; isTerminal: boolean }) | null;
  allowed: StatusOption[];
  /** Client testing 2026-10-09 (E9) — every status of this service, in order. */
  all?: (StatusOption & { isTerminal: boolean })[];
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
          {/* Client corrections 2026-10-05: internal and customer-facing status shown separately, in one place. */}
          {state.current ? (
            <span className="flex flex-col text-right leading-tight">
              <span className="text-xs text-ink-tertiary">Internal status</span>
              <span className="text-sm font-medium text-ink-primary">{state.current.name}</span>
              <span className="mt-1 text-xs text-ink-tertiary">
                Customer sees: <span className="font-medium text-ink-secondary">{state.current.customerLabel ?? "—"}</span>
              </span>
            </span>
          ) : null}
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
                    {option.customerLabel && option.customerLabel !== option.name ? `${option.name} (customer sees: ${option.customerLabel})` : option.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="text-xs text-ink-tertiary">Final status — no further transitions</span>
          )}
          {state.all && state.all.length > 0 ? (
            <details className="relative text-left">
              <summary className="cursor-pointer text-xs font-medium text-ink-accent select-none">All statuses</summary>
              <div className="absolute right-0 z-20 mt-2 w-[min(28rem,80vw)] rounded-xl border border-hairline bg-surface-1 p-3 shadow-lg">
                <p className="mb-2 text-xs text-ink-tertiary">Every status for this service. You can move only to the ones marked &ldquo;Next&rdquo;.</p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-left font-semibold text-ink-secondary">
                      <th className="py-1.5 pr-2">Internal status</th>
                      <th className="py-1.5 pr-2">Customer sees</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {state.all.map((option) => {
                      const isCurrent = option.id === state.current?.id;
                      const isNext = state.allowed.some((allowed) => allowed.id === option.id);
                      return (
                        <tr key={option.id} className={cn("border-b border-hairline last:border-b-0", isCurrent && "bg-accent/10")}>
                          <td className="py-1.5 pr-2 font-medium text-ink-primary">{option.name}</td>
                          <td className="py-1.5 pr-2 text-ink-secondary">{option.customerLabel ?? "—"}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            {isCurrent ? (
                              <span className="font-semibold text-ink-accent">Current</span>
                            ) : isNext ? (
                              <span className="font-semibold text-success">Next</span>
                            ) : option.isTerminal ? (
                              <span className="text-ink-tertiary">Final</span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
