"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

export interface OtbBookingView {
  otbReference: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  outcomeNote: string | null;
  /** Airline TAT from payment, in India working days/hours (ISO; a date-only value is local IST). */
  expectedBy: string | null;
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type ReasonAction = "ADDITIONAL_DOCUMENTS" | "REJECT" | "UNABLE_TO_PROCESS";

const REASON_COPY: Record<ReasonAction, { label: string; button: string; hint: string }> = {
  ADDITIONAL_DOCUMENTS: { label: "What the airline asked for", button: "Additional Documents Required", hint: "Use Request Document below for each file the customer must upload." },
  REJECT: { label: "Airline's rejection reason", button: "OTB Rejected", hint: "The airline's decision — no refund after airline processing." },
  UNABLE_TO_PROCESS: { label: "Why TripNexio can't process it", button: "Unable to Process", hint: "Before airline processing only. Raises a refund for approval; never shown as an airline rejection." },
};

/**
 * P18 — OTB staff actions on Booking detail (OTB.md §10-15). Each button
 * goes through the status engine, so only the steps valid from the current
 * status succeed; the timestamps and the OTB PNR/reference are recorded
 * for the CRM (§20).
 */
export function OtbActionsPanel({
  bookingId,
  view,
  currentStatus,
  onChanged,
}: {
  bookingId: string;
  view: OtbBookingView;
  currentStatus: string | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const run = async (key: string, body: Record<string, unknown>) => {
    setPending(key);
    setErrors({});
    try {
      const result = await postJson<{ message: string }>(`/api/bookings/${bookingId}/otb-action`, body);
      toast.success(result.message);
      setReference("");
      setReason("");
      setReasonAction(null);
      onChanged();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors ?? {});
        toast.error(error.message);
      } else {
        toast.error("Couldn't complete that action.");
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">OTB — airline processing</h2>
        <span className="text-xs text-ink-tertiary">Current: {currentStatus ?? "—"}</span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-tertiary">Submitted to airline</dt>
          <dd className="font-medium text-ink-primary">{fmt(view.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Approved / rejected</dt>
          <dd className="font-medium text-ink-primary">{fmt(view.decidedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">OTB PNR / reference</dt>
          <dd className="font-medium text-ink-primary">{view.otbReference ?? "—"}</dd>
        </div>
      </dl>
      {view.expectedBy && !view.decidedAt ? (
        <p className="text-xs text-ink-secondary">Expected by (airline TAT, working days): {fmt(view.expectedBy)}</p>
      ) : null}
      {view.outcomeNote ? <p className="text-xs text-ink-secondary">Airline response / reason: {view.outcomeNote}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" isLoading={pending === "STAFF_VERIFICATION"} onClick={() => void run("STAFF_VERIFICATION", { action: "STAFF_VERIFICATION" })}>
          Staff Verification
        </Button>
        <Button type="button" size="sm" variant="ghost" isLoading={pending === "SUBMIT_TO_AIRLINE"} onClick={() => void run("SUBMIT_TO_AIRLINE", { action: "SUBMIT_TO_AIRLINE" })}>
          Submitted to Airline
        </Button>
        <Button type="button" size="sm" variant="ghost" isLoading={pending === "AIRLINE_PROCESSING"} onClick={() => void run("AIRLINE_PROCESSING", { action: "AIRLINE_PROCESSING" })}>
          Airline Processing
        </Button>
        {(Object.keys(REASON_COPY) as ReasonAction[]).map((action) => (
          <Button key={action} type="button" size="sm" variant="ghost" onClick={() => setReasonAction(reasonAction === action ? null : action)}>
            {REASON_COPY[action].button}…
          </Button>
        ))}
      </div>

      {reasonAction ? (
        <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
          <TextField
            label={REASON_COPY[reasonAction].label}
            name={`otb-reason-${bookingId}`}
            hint={REASON_COPY[reasonAction].hint}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={errors.reason?.[0]}
            disabled={pending !== null}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" isLoading={pending === reasonAction} onClick={() => void run(reasonAction, { action: reasonAction, reason })}>
              Confirm: {REASON_COPY[reasonAction].button}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
        <div className="min-w-56 flex-1">
          <TextField
            label="OTB PNR / reference (required to approve)"
            name={`otb-ref-${bookingId}`}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            error={errors.otbReference?.[0]}
            disabled={pending !== null}
          />
        </div>
        <Button type="button" size="sm" isLoading={pending === "APPROVE"} disabled={reference.trim().length < 3} onClick={() => void run("APPROVE", { action: "APPROVE", otbReference: reference })}>
          OTB Approved
        </Button>
      </div>
    </section>
  );
}
