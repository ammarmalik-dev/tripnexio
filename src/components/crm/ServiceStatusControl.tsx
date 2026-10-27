"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Mail, MailX } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { cn } from "@/lib/cn";

type InputKey = "reason" | "nextStep" | "authority" | "dueDate" | "cancellationCharges" | "estimatedRefund" | "cancellationQuoteExpiry";

interface StatusOption {
  id: string;
  name: string;
  customerLabel?: string | null;
  /** Client doc 2026-10-20 — the customer gets this status's email + WhatsApp message. */
  notifies?: boolean;
  /** …and these are what staff fill in for it (shown to the customer). */
  inputs?: InputKey[];
}

interface StatusState {
  current: (StatusOption & { customerLabel: string | null; isTerminal: boolean }) | null;
  allowed: StatusOption[];
  /** Client testing 2026-10-09 (E9) — every status of this service, in order. */
  all?: (StatusOption & { isTerminal: boolean })[];
  /** Client doc 2026-10-15 (I9) — the viewer is an Admin and may move to any status (with a reason). */
  canOverride?: boolean;
  /** Client doc 2026-10-27 (N1/C13) — next steps taken from the booking's action panel (e.g. Sent to Airlines: asks for the vendor). */
  panelOnly?: { id: string; name: string }[];
}

const INPUT_LABELS: Record<InputKey, { label: string; placeholder?: string }> = {
  reason: { label: "Reason shown to the customer", placeholder: "Customer-safe wording — no internal notes" },
  nextStep: { label: "Next step for the customer (optional)" },
  authority: { label: "Requested by (optional)", placeholder: "e.g. Embassy, Immigration" },
  dueDate: { label: "Due date (optional)", placeholder: "e.g. 25 Oct 2026" },
  cancellationCharges: { label: "Cancellation charges", placeholder: "e.g. ₹2,500" },
  estimatedRefund: { label: "Estimated refund", placeholder: "e.g. ₹9,800" },
  cancellationQuoteExpiry: { label: "Cancellation quote valid until", placeholder: "e.g. 22 Oct 2026, 6:00 PM" },
};

/** Statuses whose message must carry a reason (client doc 2026-10-20: on hold, rejected, not eligible…). */
const REASON_REQUIRED = /hold|reject|not accepted|not eligible|unable/i;

/**
 * CRM Change Status for a Lead or Booking (P08 — CRM.md §14). Client doc 2026-10-20 (L7): the next
 * internal statuses are buttons on the left; picking one shows what the customer will be told (their
 * status label, and whether an email + WhatsApp goes out) and asks for the customer-safe reason / next
 * step when that message uses one. The current internal status and what the customer sees are on the right.
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
  const [target, setTarget] = useState<StatusOption | null>(null);
  const [values, setValues] = useState<Partial<Record<InputKey, string>>>({});
  const { confirm, dialog } = useConfirmAction();

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

  const choose = (option: StatusOption) => {
    setTarget(option);
    setValues({});
  };

  const reasonRequired = !!target?.inputs?.includes("reason") && REASON_REQUIRED.test(target.name);

  const apply = async () => {
    if (!target) return;
    if (reasonRequired && (values.reason?.trim().length ?? 0) < 3) {
      toast.error("Enter the reason the customer will see.");
      return;
    }
    setPending(true);
    try {
      const inputs = Object.fromEntries(Object.entries(values).filter(([, value]) => value && value.trim()));
      const updated = await patchJson<{ status: TCoarse }>(endpoint, { serviceStatusId: target.id, ...(Object.keys(inputs).length ? { inputs } : {}) });
      toast.success(`Status updated to ${target.name}${target.notifies ? " — customer notified" : ""}`);
      onChanged(updated.status);
      setTarget(null);
      setReloadNonce((n) => n + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  // Client doc 2026-10-15 (I9) — Admin moves a record to any status (e.g. back after a staff mistake), with a reason.
  const handleOverride = async (serviceStatusId: string) => {
    const option = state?.all?.find((row) => row.id === serviceStatusId);
    if (!option) return;
    const reason = await confirm({
      title: `Admin override: move to "${option.name}"?`,
      description: "This skips the normal status flow (including moving back or out of a final status). The customer is notified as usual, and your reason is saved in the audit log.",
      confirmLabel: "Override status",
    });
    if (!reason) return;
    setPending(true);
    try {
      const updated = await patchJson<{ status: TCoarse }>(endpoint, { serviceStatusId, override: true, note: reason });
      toast.success(`Status moved to ${option.name} (Admin override)`);
      onChanged(updated.status);
      setReloadNonce((n) => n + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't override the status.");
    } finally {
      setPending(false);
    }
  };

  if (loadError) {
    return (
      <button type="button" className="text-xs text-error underline" onClick={() => setReloadNonce((n) => n + 1)}>
        Couldn&apos;t load statuses — retry
      </button>
    );
  }
  if (state === null) return <Skeleton className="h-9 w-full" />;

  return (
    <div className="flex w-full flex-col gap-3">
      {dialog}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {/* Left — the next internal statuses as buttons. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-ink-tertiary uppercase">Move to</span>
          {state.allowed.length > 0 || (state.panelOnly?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Change status">
              {state.allowed.map((option) => (
                <button
                  key={option.id}
                  id={option.id === state.allowed[0]?.id ? selectId : undefined}
                  type="button"
                  disabled={pending}
                  onClick={() => choose(option)}
                  title={option.customerLabel && option.customerLabel !== option.name ? `Customer sees: ${option.customerLabel}` : undefined}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50",
                    target?.id === option.id ? "border-accent bg-accent text-ink-on-dark-primary" : "border-hairline bg-surface-1 text-ink-primary hover:border-accent/60 hover:bg-accent/10"
                  )}
                >
                  {option.notifies ? <Mail className="h-3 w-3 opacity-70" aria-label="customer notified" /> : null}
                  {option.name}
                </button>
              ))}
              {(state.panelOnly ?? []).map((step) => (
                <span
                  key={step.id}
                  title="Taken from the action panel in Operations — it asks for the vendor and needs every document validated."
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline px-2.5 py-1 text-xs font-medium text-ink-secondary"
                >
                  {step.name} <span className="text-ink-tertiary">· Operations panel</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-ink-tertiary">Final status — no further moves</span>
          )}
        </div>

        {/* Right — where the record is now (internal + what the customer sees). */}
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-3">
          {badge}
          {state.current ? (
            <span className="flex flex-col text-right leading-tight">
              <span className="text-xs text-ink-tertiary">Internal status</span>
              <span className="text-sm font-medium text-ink-primary">{state.current.name}</span>
              <span className="mt-1 text-xs text-ink-tertiary">
                Customer sees: <span className="font-medium text-ink-secondary">{state.current.customerLabel ?? "—"}</span>
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {target ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <p className="text-sm text-ink-primary">
            Move to <strong>{target.name}</strong>
            {target.customerLabel && target.customerLabel !== target.name ? (
              <>
                {" "}
                — customer sees <strong>{target.customerLabel}</strong>
              </>
            ) : null}
            .
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
            {target.notifies ? <Mail className="h-3.5 w-3.5" aria-hidden="true" /> : <MailX className="h-3.5 w-3.5" aria-hidden="true" />}
            {target.notifies ? "The customer gets this status's email + WhatsApp message." : "Internal status — no message to the customer."}
          </p>
          {(target.inputs ?? []).length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(target.inputs ?? []).map((key) => (
                <TextField
                  key={key}
                  name={`${selectId}-${key}`}
                  label={key === "reason" && reasonRequired ? INPUT_LABELS.reason.label : key === "reason" ? `${INPUT_LABELS.reason.label} (optional)` : INPUT_LABELS[key].label}
                  placeholder={INPUT_LABELS[key].placeholder}
                  value={values[key] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  disabled={pending}
                  maxLength={key === "reason" ? 500 : 300}
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void apply()} isLoading={pending}>
              Confirm: {target.name}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.canOverride && state.all && state.all.length > 0 ? (
          <>
            <label htmlFor={`${selectId}-override`} className="sr-only">
              Admin override — move to any status
            </label>
            <select
              id={`${selectId}-override`}
              value=""
              disabled={pending}
              onChange={(event) => void handleOverride(event.target.value)}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[150px] border-warning/50 text-xs text-warning")}
            >
              <option value="" disabled>
                Admin override…
              </option>
              {state.all
                .filter((option) => option.id !== state.current?.id)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </select>
          </>
        ) : null}
        {state.all && state.all.length > 0 ? (
          <details className="relative text-left" data-popover>
            <summary className="cursor-pointer text-xs font-medium text-ink-accent select-none">All statuses</summary>
            <div className="absolute right-0 z-30 mt-2 max-h-[70vh] w-[min(28rem,80vw)] overflow-y-auto rounded-xl border border-hairline bg-surface-1 p-3 shadow-lg">
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
      </div>
    </div>
  );
}
