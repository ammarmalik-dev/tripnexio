"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { getJson, putJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { STAFF_SERVICE_ACTIONS, type StaffServiceAction } from "@/lib/auth/service-actions";
import type { StaffServicePermissionsResponse } from "@/lib/validation/staff-service-permissions-schema";
import type { ServiceType } from "../../generated/prisma/enums";

type Matrix = Partial<Record<ServiceType, StaffServiceAction[]>>;
type Mode = "ROLE" | "CUSTOM";

function toMatrix(grants: StaffServicePermissionsResponse["grants"]): Matrix {
  const matrix: Matrix = {};
  for (const grant of grants) matrix[grant.serviceType] = grant.actions as StaffServiceAction[];
  return matrix;
}

function snapshot(mode: Mode, matrix: Matrix, limit: string): string {
  const grants = mode === "ROLE" ? [] : SERVICE_TYPE_OPTIONS.filter((option) => matrix[option.value]).map((option) => [option.value, [...matrix[option.value]!].sort()]);
  return JSON.stringify({ mode, grants, limit: limit.trim() });
}

/**
 * Admin handover §1 / §17 — services × actions matrix for one staff member plus their refund approval
 * limit. Saving asks for a confirmation reason (audited). UI only: every route enforces it server-side.
 */
export function StaffServicePermissionsEditor({ userId, userName }: { userId: string; userName: string }) {
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">("loading");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [saved, setSaved] = useState<StaffServicePermissionsResponse | null>(null);
  const [mode, setMode] = useState<Mode>("ROLE");
  const [matrix, setMatrix] = useState<Matrix>({});
  const [limit, setLimit] = useState("");
  const [limitError, setLimitError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState("loading");
      try {
        const result = await getJson<StaffServicePermissionsResponse>(`/api/admin/users/${userId}/service-permissions`);
        if (cancelled) return;
        setSaved(result);
        setMode(result.grants.length > 0 ? "CUSTOM" : "ROLE");
        setMatrix(toMatrix(result.grants));
        setLimit(result.refundApprovalLimit === null ? "" : String(result.refundApprovalLimit));
        setLoadState("success");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadNonce]);

  if (loadState === "loading") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (loadState === "error" || !saved) {
    return (
      <ErrorState
        title="Couldn't load service permissions"
        description="Please try again."
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const savedSnapshot = snapshot(saved.grants.length > 0 ? "CUSTOM" : "ROLE", toMatrix(saved.grants), saved.refundApprovalLimit === null ? "" : String(saved.refundApprovalLimit));
  const dirty = snapshot(mode, matrix, limit) !== savedSnapshot;

  const toggleService = (service: ServiceType) => {
    setMatrix((current) => {
      const next = { ...current };
      if (next[service]) delete next[service];
      else next[service] = ["VIEW"];
      return next;
    });
  };

  const toggleAction = (service: ServiceType, action: StaffServiceAction) => {
    setMatrix((current) => {
      const actions = current[service] ?? [];
      return { ...current, [service]: actions.includes(action) ? actions.filter((entry) => entry !== action) : [...actions, action] };
    });
  };

  const parseLimit = (): number | null | undefined => {
    const trimmed = limit.trim().replace(/,/g, "");
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.round(value * 100) / 100;
  };

  const startSave = () => {
    if (parseLimit() === undefined) {
      setLimitError("Enter an amount of 0 or more, or leave it blank for no limit.");
      return;
    }
    setLimitError("");
    if (mode === "CUSTOM" && Object.keys(matrix).length === 0) {
      toast.error("Tick at least one service, or choose “Use role permissions for every service”.");
      return;
    }
    setConfirming(true);
  };

  const save = async (reason: string) => {
    setSaving(true);
    try {
      const grants = mode === "ROLE" ? [] : SERVICE_TYPE_OPTIONS.filter((option) => matrix[option.value]).map((option) => ({ serviceType: option.value, actions: matrix[option.value]! }));
      const result = await putJson<StaffServicePermissionsResponse>(`/api/admin/users/${userId}/service-permissions`, {
        mode,
        grants,
        refundApprovalLimit: parseLimit() ?? null,
        reason,
      });
      setSaved(result);
      setMode(result.grants.length > 0 ? "CUSTOM" : "ROLE");
      setMatrix(toMatrix(result.grants));
      setLimit(result.refundApprovalLimit === null ? "" : String(result.refundApprovalLimit));
      setConfirming(false);
      toast.success(`${userName}'s service permissions saved.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the service permissions. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {saved.isFullAdmin ? (
        <p className="rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-secondary">
          This account has full admin access — service permissions and the refund limit never restrict it.
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Service permission mode</legend>
        <label className="flex items-center gap-2 text-sm text-ink-primary">
          <input type="radio" name={`mode-${userId}`} checked={mode === "ROLE"} onChange={() => setMode("ROLE")} disabled={saving} />
          Use role permissions for every service
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-primary">
          <input type="radio" name={`mode-${userId}`} checked={mode === "CUSTOM"} onChange={() => setMode("CUSTOM")} disabled={saving} />
          Set permissions per service (services left unticked are closed)
        </label>
      </fieldset>

      {mode === "CUSTOM" ? (
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[860px] text-left text-xs">
            <caption className="sr-only">Actions allowed per service for {userName}</caption>
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Service
                </th>
                {STAFF_SERVICE_ACTIONS.map((action) => (
                  <th key={action.value} scope="col" className="px-2 py-2 text-center font-semibold" title={action.description}>
                    {action.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SERVICE_TYPE_OPTIONS.map((service) => {
                const actions = matrix[service.value];
                const enabled = Boolean(actions);
                return (
                  <tr key={service.value} className="border-t border-hairline">
                    <th scope="row" className="px-3 py-2 font-medium">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={enabled} onChange={() => toggleService(service.value)} disabled={saving} />
                        {service.label}
                      </label>
                    </th>
                    {STAFF_SERVICE_ACTIONS.map((action) => (
                      <td key={action.value} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${service.label}: ${action.label}`}
                          checked={enabled && actions!.includes(action.value)}
                          disabled={!enabled || saving}
                          onChange={() => toggleAction(service.value, action.value)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs text-ink-tertiary">Each action also needs the matching permission in the staff member&apos;s role.</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={`refund-limit-${userId}`} className="text-sm font-semibold text-ink-heading">
          Refund approval limit (₹)
        </label>
        <input
          id={`refund-limit-${userId}`}
          inputMode="decimal"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          placeholder="No limit"
          disabled={saving}
          aria-invalid={limitError ? true : undefined}
          aria-describedby={`refund-limit-help-${userId}`}
          className={cn(fieldControlClass, fieldBorderClass(Boolean(limitError)), "h-10 max-w-xs text-sm")}
        />
        <span id={`refund-limit-help-${userId}`} className={cn("text-xs", limitError ? "text-error" : "text-ink-tertiary")}>
          {limitError || "Leave blank for no limit. Refunds above it need someone with a higher limit."}
        </span>
      </div>

      {dirty ? (
        <Button type="button" size="sm" className="self-start" onClick={startSave} isLoading={saving}>
          Save Service Permissions
        </Button>
      ) : null}

      {confirming ? (
        <ConfirmActionDialog
          title="Change service permissions"
          description={`${userName}'s service access and refund approval limit will change immediately.`}
          confirmLabel="Save"
          pending={saving}
          onConfirm={(reason) => void save(reason)}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
