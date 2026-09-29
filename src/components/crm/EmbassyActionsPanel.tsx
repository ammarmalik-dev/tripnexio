"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { EMBASSY_ACTIONS, type EmbassyAction } from "@/lib/new-visa/embassy-actions";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * P11 — New Visa embassy actions on Booking detail, plus the three dates staff
 * need side by side (Booking, Applied to Embassy, Travel). Each action goes
 * through the status engine, so only a transition configured for the booking's
 * current status succeeds. Rejected asks for a reason the customer will see.
 * After Visa Approved, deliver the visa PDF under "Deliver to customer".
 */
export function EmbassyActionsPanel({
  bookingId,
  bookingDate,
  appliedToEmbassyAt,
  travelDate,
  currentStatus,
  rejectionReason,
  onChanged,
}: {
  bookingId: string;
  bookingDate: string;
  appliedToEmbassyAt: string | null;
  travelDate: string | null;
  currentStatus: string | null;
  rejectionReason: string | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<EmbassyAction | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);

  const run = async (action: EmbassyAction, reason?: string) => {
    setPending(action);
    try {
      await postJson(`/api/bookings/${bookingId}/embassy-action`, { action, reason });
      toast.success(`${EMBASSY_ACTIONS[action].label} recorded.`);
      setConfirmingReject(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't record that action. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Embassy</h2>
        {currentStatus ? <span className="text-xs text-ink-tertiary">Current status: {currentStatus}</span> : null}
      </div>
      <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-tertiary">Booking Date</dt>
          <dd className="text-sm font-medium text-ink-primary">{formatDate(bookingDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Applied to Embassy</dt>
          <dd className="text-sm font-medium text-ink-primary">{formatDate(appliedToEmbassyAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Travel Date</dt>
          <dd className="text-sm font-medium text-ink-primary">{formatDate(travelDate)}</dd>
        </div>
      </dl>
      {rejectionReason ? (
        <p className="mb-3 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">Rejected: {rejectionReason}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(EMBASSY_ACTIONS) as EmbassyAction[]).map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === "REJECTED" ? "ghost" : "glass"}
            isLoading={pending === action}
            disabled={pending !== null}
            onClick={() => (action === "REJECTED" ? setConfirmingReject(true) : void run(action))}
          >
            {EMBASSY_ACTIONS[action].label}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-tertiary">After Visa Approved, deliver the visa PDF below — that moves it to Visa Delivered; complete the booking after that.</p>
      {confirmingReject ? (
        <ConfirmActionDialog
          title="Mark this visa as rejected?"
          description="Enter the embassy's reason — the customer will see it on their account and Track Status."
          confirmLabel="Mark Rejected"
          pending={pending === "REJECTED"}
          onConfirm={(reason) => void run("REJECTED", reason)}
          onCancel={() => setConfirmingReject(false)}
        />
      ) : null}
    </section>
  );
}
