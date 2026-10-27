"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { ApplyVendorSelect } from "./booking/BookingVendorPicker";

export interface OtbBookingView {
  /** Legacy — the OTB PNR / reference recorded before client doc 2026-10-27 (C10) dropped it; shown only when set. */
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

type ReasonAction = "REJECT" | "UNABLE_TO_PROCESS";

const REASON_COPY: Record<ReasonAction, { label: string; button: string; hint: string }> = {
  REJECT: { label: "Airline's rejection reason", button: "OTB Rejected", hint: "The airline's decision — no refund after airline processing." },
  UNABLE_TO_PROCESS: { label: "Why TripNexio can't process it", button: "Unable to Process", hint: "Before airline processing only. Raises a refund for approval; never shown as an airline rejection." },
};

/**
 * P18 — OTB staff actions on Booking detail (OTB.md §10-15). Each button
 * goes through the status engine, so only the steps valid from the current
 * status succeed; the timestamps are recorded for the CRM (§20).
 * Client doc 2026-10-27: Sent to Airlines asks for the vendor (its rate sets the cost, C13) and waits for every
 * document to be validated (C1); OTB Approved needs no PNR / reference (C10).
 */
export function OtbActionsPanel({
  bookingId,
  view,
  currentStatus,
  documentsBlockedReason = null,
  onChanged,
}: {
  bookingId: string;
  view: OtbBookingView;
  currentStatus: string | null;
  /** Client doc 2026-10-27 (C1) — documents not all validated yet (the server checks too). */
  documentsBlockedReason?: string | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const run = async (key: string, body: Record<string, unknown>) => {
    setPending(key);
    setErrors({});
    try {
      const result = await postJson<{ message: string }>(`/api/bookings/${bookingId}/otb-action`, body);
      toast.success(result.message);
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

      <dl className={`grid grid-cols-1 gap-3 text-sm ${view.otbReference ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div>
          <dt className="text-xs text-ink-tertiary">Submitted to airline</dt>
          <dd className="font-medium text-ink-primary">{fmt(view.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Approved / rejected</dt>
          <dd className="font-medium text-ink-primary">{fmt(view.decidedAt)}</dd>
        </div>
        {view.otbReference ? (
          <div>
            <dt className="text-xs text-ink-tertiary">OTB PNR / reference</dt>
            <dd className="font-medium text-ink-primary">{view.otbReference}</dd>
          </div>
        ) : null}
      </dl>
      {view.expectedBy && !view.decidedAt ? (
        <p className="text-xs text-ink-secondary">Expected by (airline TAT, working days): {fmt(view.expectedBy)}</p>
      ) : null}
      {view.outcomeNote ? <p className="text-xs text-ink-secondary">Airline response / reason: {view.outcomeNote}</p> : null}

      {!view.submittedAt ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-hairline p-3">
          <div className="min-w-56 flex-1">
            <ApplyVendorSelect
              id={`otb-vendor-${bookingId}`}
              label="Vendor"
              bookingId={bookingId}
              serviceType="OTB"
              value={vendorId}
              onChange={setVendorId}
              disabled={pending !== null}
              error={errors.vendorId?.[0]}
            />
          </div>
          <div className="flex flex-col items-end gap-1">
            {documentsBlockedReason ? <span className="max-w-xs text-right text-xs text-warning">{documentsBlockedReason}</span> : null}
            <Button
              type="button"
              size="sm"
              isLoading={pending === "SUBMIT_TO_AIRLINE"}
              disabled={pending !== null || !vendorId || documentsBlockedReason !== null}
              onClick={() => void run("SUBMIT_TO_AIRLINE", { action: "SUBMIT_TO_AIRLINE", vendorId })}
            >
              Sent to Airlines
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {/* Client doc 2026-10-20 — airline asked for more: request the documents (Booking Documents), then send them on. */}
        <Button type="button" size="sm" variant="ghost" isLoading={pending === "ADDITIONAL_DOCUMENTS"} onClick={() => void run("ADDITIONAL_DOCUMENTS", { action: "ADDITIONAL_DOCUMENTS" })}>
          Additional Documents Sent to Airline
        </Button>
        {/* Client doc 2026-10-27 (C10) — the airline approved it: no OTB PNR / reference to enter. */}
        <Button type="button" size="sm" variant="ghost" isLoading={pending === "APPROVE"} disabled={pending !== null} onClick={() => void run("APPROVE", { action: "APPROVE" })}>
          OTB Approved
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

    </section>
  );
}
