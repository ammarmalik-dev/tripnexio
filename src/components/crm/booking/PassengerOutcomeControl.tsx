"use client";

import { useState } from "react";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ConfirmActionDialog } from "@/components/crm/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { ApiError, patchJson } from "@/lib/api/client";
import { PASSENGER_OUTCOME_LABELS } from "@/lib/bookings/passenger-outcomes";
import { cn } from "@/lib/cn";
import type { PassengerOutcome } from "../../../generated/prisma/enums";
import { formatRupees } from "@/lib/format-currency";

const OUTCOME_STYLE: Record<PassengerOutcome, string> = {
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-error/10 text-error",
  CANCELLED: "bg-warning/10 text-warning",
};

function money(value: number): string {
  return formatRupees(value);
}

/**
 * Client doc 2026-10-15 (I4) — one passenger's own result (approved / rejected / cancelled) with the
 * selling price, cancellation amount and refund it implies. Saving needs a reason and is audited; the
 * refund itself is raised from Payments with this passenger selected.
 */
export function PassengerOutcomeControl({
  bookingId,
  passengerId,
  outcome,
  outcomeNote,
  amounts,
  onChanged,
}: {
  bookingId: string;
  passengerId: string;
  outcome: PassengerOutcome | null;
  outcomeNote: string | null;
  amounts: { selling: number; cancellation: number; refund: number } | null;
  onChanged: () => void;
}) {
  const [pendingOutcome, setPendingOutcome] = useState<PassengerOutcome | "" | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (reason: string) => {
    if (pendingOutcome === null) return;
    setSaving(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/passengers/${passengerId}/outcome`, { outcome: pendingOutcome || null, reason });
      toast.success(pendingOutcome ? `Passenger marked ${PASSENGER_OUTCOME_LABELS[pendingOutcome]}.` : "Passenger result cleared.");
      setPendingOutcome(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the passenger's result.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-hairline pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-tertiary" title="This passenger's own outcome — used for partial approval / cancellation and their refund share">
          Result for this passenger
        </span>
        <div className="flex items-center gap-2">
          {outcome ? <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", OUTCOME_STYLE[outcome])}>{PASSENGER_OUTCOME_LABELS[outcome]}</span> : null}
          <label htmlFor={`outcome-${passengerId}`} className="sr-only">
            Set this passenger&apos;s result
          </label>
          <select
            id={`outcome-${passengerId}`}
            value=""
            disabled={saving}
            onChange={(event) => setPendingOutcome(event.target.value as PassengerOutcome | "")}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[120px] text-xs")}
          >
            <option value="" disabled>
              {outcome ? "Change result…" : "Approved / Rejected / Cancelled…"}
            </option>
            {(Object.keys(PASSENGER_OUTCOME_LABELS) as PassengerOutcome[])
              .filter((value) => value !== outcome)
              .map((value) => (
                <option key={value} value={value}>
                  {PASSENGER_OUTCOME_LABELS[value]}
                </option>
              ))}
            {outcome ? <option value="">In progress (clear)</option> : null}
          </select>
        </div>
      </div>
      {amounts ? (
        <p className="text-xs text-ink-tertiary">
          Selling {money(amounts.selling)} · Cancellation {money(amounts.cancellation)}
          {outcome === "CANCELLED" || outcome === "REJECTED" ? (
            <>
              {" "}
              · <span className="font-semibold text-ink-secondary">Refund {money(amounts.refund)}</span> (raise it from Payments with this passenger selected)
            </>
          ) : null}
        </p>
      ) : null}
      {outcomeNote ? <p className="text-xs text-ink-tertiary">Note: {outcomeNote}</p> : null}
      {pendingOutcome !== null ? (
        <ConfirmActionDialog
          title={pendingOutcome ? `Mark this passenger ${PASSENGER_OUTCOME_LABELS[pendingOutcome]}?` : "Clear this passenger's result?"}
          description="Saved with your reason in the audit log. The booking shows Partially Approved / Partially Cancelled when passengers differ."
          confirmLabel="Save result"
          pending={saving}
          onConfirm={(reason) => void save(reason)}
          onCancel={() => setPendingOutcome(null)}
        />
      ) : null}
    </div>
  );
}
