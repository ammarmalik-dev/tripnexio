"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { EXIT_METHOD_LABELS, VISA_CHANGE_ACTIONS, type ExitMethod, type VisaChangeAction } from "@/lib/visa-change/staff-actions";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

export interface VisaChangeBookingView {
  changeType: ExitMethod | null;
  packageGenerated: boolean;
  /** The exit airport / border from the operational details, to prefill Exit Completed. */
  defaultExitLocation: string | null;
  exitCompletedAt: string | null;
  exitDetails: { method: ExitMethod; location: string; notes: string | null; staffName: string } | null;
}

function nowLocalInput(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/**
 * P14 — Visa Change staff actions on Booking detail: Generate Package (after
 * payment, complete operational details and verified documents), Exit
 * Completed (date/time, method, airport/border, notes — the customer uploads
 * nothing), then New Visa Processing, Additional Documents Required, Visa
 * Approved or Visa Rejected (with a reason). All go through the status
 * engine, so only a transition configured for the current status succeeds.
 */
export function VisaChangeActionsPanel({
  bookingId,
  view,
  currentStatus,
  rejectionReason,
  onChanged,
}: {
  bookingId: string;
  view: VisaChangeBookingView;
  currentStatus: string | null;
  rejectionReason: string | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<VisaChangeAction | "PACKAGE" | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [exit, setExit] = useState({
    exitAt: nowLocalInput(),
    method: (view.changeType ?? "AIRPORT_TO_AIRPORT") as ExitMethod,
    location: view.defaultExitLocation ?? "",
    notes: "",
  });

  const generatePackage = async () => {
    setPending("PACKAGE");
    try {
      await postJson(`/api/bookings/${bookingId}/visa-change-package`, {});
      toast.success("Package generated and sent to the customer.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't generate the package. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const run = async (action: VisaChangeAction, extra: Record<string, unknown> = {}) => {
    setPending(action);
    try {
      await postJson(`/api/bookings/${bookingId}/visa-change-action`, { action, ...extra });
      toast.success(`${VISA_CHANGE_ACTIONS[action].label} recorded.`);
      setConfirmingReject(false);
      setShowExitForm(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't record that action. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const laterActions: VisaChangeAction[] = ["NEW_VISA_PROCESSING", "ADDITIONAL_DOCS", "APPROVED", "REJECTED"];

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Visa Change</h2>
        {currentStatus ? <span className="text-xs text-ink-tertiary">Current status: {currentStatus}</span> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => void generatePackage()} isLoading={pending === "PACKAGE"} disabled={pending !== null || view.packageGenerated}>
          <FileDown className="h-4 w-4" aria-hidden="true" />
          {view.packageGenerated ? "Package generated" : "Generate Package"}
        </Button>
        <span className="text-xs text-ink-tertiary">Needs payment received, complete operational details and every document verified.</span>
      </div>

      {view.exitCompletedAt && view.exitDetails ? (
        <p className="mb-3 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
          Exit completed {new Date(view.exitCompletedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} —{" "}
          {EXIT_METHOD_LABELS[view.exitDetails.method]} via {view.exitDetails.location} (recorded by {view.exitDetails.staffName})
          {view.exitDetails.notes ? `. Notes: ${view.exitDetails.notes}` : ""}
        </p>
      ) : showExitForm ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-dashed border-glass-border bg-surface-2 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Exit date & time" name="exitAt" type="datetime-local" value={exit.exitAt} onChange={(e) => setExit({ ...exit, exitAt: e.target.value })} required />
            <FormField label="Exit method" htmlFor="exit-method" required>
              <select
                id="exit-method"
                value={exit.method}
                onChange={(e) => setExit({ ...exit, method: e.target.value as ExitMethod })}
                className={cn(fieldControlClass, fieldBorderClass(false))}
              >
                {(Object.keys(EXIT_METHOD_LABELS) as ExitMethod[]).map((method) => (
                  <option key={method} value={method}>
                    {EXIT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </FormField>
            <TextField label="Airport / Border" name="exitLocation" value={exit.location} onChange={(e) => setExit({ ...exit, location: e.target.value })} required />
          </div>
          <Textarea label="Notes (optional)" name="exitNotes" rows={2} value={exit.notes} onChange={(e) => setExit({ ...exit, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowExitForm(false)} disabled={pending !== null}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={pending === "EXIT_COMPLETED"}
              disabled={pending !== null || !exit.exitAt || exit.location.trim().length < 2}
              onClick={() =>
                void run("EXIT_COMPLETED", {
                  exit: { exitAt: new Date(exit.exitAt).toISOString(), method: exit.method, location: exit.location.trim(), notes: exit.notes.trim() || undefined },
                })
              }
            >
              Record Exit Completed
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <Button type="button" size="sm" variant="glass" onClick={() => setShowExitForm(true)} disabled={pending !== null}>
            Exit Completed…
          </Button>
        </div>
      )}

      {rejectionReason ? <p className="mb-3 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">Rejected: {rejectionReason}</p> : null}
      <div className="flex flex-wrap gap-2">
        {laterActions.map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === "REJECTED" ? "ghost" : "glass"}
            isLoading={pending === action}
            disabled={pending !== null}
            onClick={() => (action === "REJECTED" ? setConfirmingReject(true) : void run(action))}
          >
            {VISA_CHANGE_ACTIONS[action].label}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-tertiary">
        Additional documents: request them per passenger below (the customer uploads from their payment page). After Visa Approved, deliver the visa PDF
        below — that moves it to Visa Delivered; complete the booking after that.
      </p>
      {confirmingReject ? (
        <ConfirmActionDialog
          title="Mark this visa as rejected?"
          description="Enter the reason — the customer will see it on their account and Track Status."
          confirmLabel="Mark Rejected"
          pending={pending === "REJECTED"}
          onConfirm={(reason) => void run("REJECTED", { reason })}
          onCancel={() => setConfirmingReject(false)}
        />
      ) : null}
    </section>
  );
}
