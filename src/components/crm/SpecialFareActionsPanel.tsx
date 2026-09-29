"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

export interface SpecialFareBookingView {
  finalConfirmedAt: string | null;
  alternativeOffer: {
    route?: string | null;
    airline?: string | null;
    flightNumber?: string | null;
    sellingPrice?: number;
    vendorCost?: number | null;
    direction: "HIGHER" | "LOWER" | "SAME" | "NONE";
    difference: number;
    decision: "PAY" | "REFUND" | null;
  } | null;
  pnr: string | null;
  pnrVendorReference: string | null;
  pnrRecordedAt: string | null;
  ticketIssuedAt: string | null;
  ticketBaggage: string | null;
  tickets: { passengerId: string; fullName: string; ticketNumber: string | null }[];
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function fmt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const EMPTY_ALT = { route: "", airline: "", flightNumber: "", flightDateTime: "", arrivalDateTime: "", baggageAllowance: "", terminal: "", reportingTime: "", fareType: "", sellingPrice: "", vendorCost: "" };

/**
 * P16 — Flight Special Fare post-payment operations on Booking detail
 * (Flight_Special_Fare.md §17-20): Confirm Availability, Unavailable (enter an
 * alternative — the system works out higher / lower / same fare — or record
 * that there is none), Record PNR, then Issue Ticket (ticket number per
 * passenger, issue time, baggage, ticket PDF). Each action goes through the
 * status engine, so only steps valid from the current status succeed.
 */
export function SpecialFareActionsPanel({
  bookingId,
  view,
  currentStatus,
  onChanged,
}: {
  bookingId: string;
  view: SpecialFareBookingView;
  currentStatus: string | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [showAlternative, setShowAlternative] = useState(false);
  const [noAlternative, setNoAlternative] = useState(false);
  const [alt, setAlt] = useState(EMPTY_ALT);
  const [pnr, setPnr] = useState({ pnr: "", vendorReference: "" });
  const [ticketNumbers, setTicketNumbers] = useState<Record<string, string>>({});
  const [issuedAt, setIssuedAt] = useState("");
  const [baggage, setBaggage] = useState("");
  const [ticketFile, setTicketFile] = useState<File | null>(null);

  const run = async (key: string, body: Record<string, unknown>) => {
    setPending(key);
    try {
      const result = await postJson<{ message: string }>(`/api/bookings/${bookingId}/special-fare-action`, body);
      toast.success(result.message);
      setShowAlternative(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't complete this action. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const submitUnavailable = () => {
    if (noAlternative) return void run("UNAVAILABLE", { action: "UNAVAILABLE", alternative: null });
    const num = (value: string) => (value.trim() === "" ? undefined : Number(value));
    const text = (value: string) => (value.trim() === "" ? undefined : value.trim());
    void run("UNAVAILABLE", {
      action: "UNAVAILABLE",
      alternative: {
        route: alt.route.trim(),
        airline: text(alt.airline),
        flightNumber: text(alt.flightNumber),
        flightDateTime: text(alt.flightDateTime),
        arrivalDateTime: text(alt.arrivalDateTime),
        baggageAllowance: text(alt.baggageAllowance),
        terminal: text(alt.terminal),
        reportingTime: text(alt.reportingTime),
        fareType: text(alt.fareType),
        sellingPrice: num(alt.sellingPrice),
        vendorCost: num(alt.vendorCost),
      },
    });
  };

  const submitTicket = async () => {
    if (!ticketFile) return;
    if (ticketFile.size > MAX_FILE_BYTES) {
      toast.error("The ticket file is too large (8MB max).");
      return;
    }
    const fileBase64 = await readAsBase64(ticketFile);
    await run("ISSUE_TICKET", {
      action: "ISSUE_TICKET",
      tickets: view.tickets.map((t) => ({ passengerId: t.passengerId, ticketNumber: (ticketNumbers[t.passengerId] ?? "").trim() })),
      issuedAt: issuedAt ? new Date(issuedAt).toISOString() : undefined,
      baggage: baggage.trim() || undefined,
      fileBase64,
    });
  };

  const offer = view.alternativeOffer;
  const allTicketNumbers = view.tickets.every((t) => (ticketNumbers[t.passengerId] ?? "").trim().length >= 4);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Special Fare — after payment</h2>
        {currentStatus ? <span className="text-xs text-ink-tertiary">Current status: {currentStatus}</span> : null}
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-tertiary">Availability confirmed</dt>
          <dd className="font-medium text-ink-primary">{fmt(view.finalConfirmedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">PNR</dt>
          <dd className="font-medium text-ink-primary">
            {view.pnr ?? "—"}
            {view.pnrVendorReference ? ` · vendor ref ${view.pnrVendorReference}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Ticket issued</dt>
          <dd className="font-medium text-ink-primary">
            {fmt(view.ticketIssuedAt)}
            {view.ticketBaggage ? ` · ${view.ticketBaggage}` : ""}
          </dd>
        </div>
      </dl>

      {offer ? (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
          {offer.direction === "NONE"
            ? "Flight unavailable — no suitable alternative; full refund raised."
            : `Alternative ${[offer.airline, offer.flightNumber].filter(Boolean).join(" ")} ${offer.route ?? ""} at ₹${offer.sellingPrice ?? "—"}${offer.vendorCost != null ? ` (vendor cost ₹${offer.vendorCost}, internal)` : ""} — ${
                offer.direction === "HIGHER" ? `₹${offer.difference} higher` : offer.direction === "LOWER" ? `₹${-offer.difference} lower (difference refund raised)` : "same fare"
              }${offer.direction === "HIGHER" ? ` · customer: ${offer.decision === "PAY" ? "paying the difference" : offer.decision === "REFUND" ? "requested refund" : "not decided yet"}` : ""}`}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="glass" onClick={() => void run("CONFIRM", { action: "CONFIRM_AVAILABILITY" })} isLoading={pending === "CONFIRM"} disabled={pending !== null}>
          Confirm Availability
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAlternative((v) => !v)} disabled={pending !== null}>
          Unavailable…
        </Button>
      </div>

      {showAlternative ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-glass-border bg-surface-2 p-4">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={noAlternative} onChange={(e) => setNoAlternative(e.target.checked)} />
            No suitable alternative (full refund)
          </label>
          {!noAlternative ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Alternative route" name="altRoute" placeholder="e.g. Delhi → Dubai" value={alt.route} onChange={(e) => setAlt({ ...alt, route: e.target.value })} required />
              <TextField label="Airline code" name="altAirline" value={alt.airline} onChange={(e) => setAlt({ ...alt, airline: e.target.value })} />
              <TextField label="Flight number" name="altFlight" value={alt.flightNumber} onChange={(e) => setAlt({ ...alt, flightNumber: e.target.value })} />
              <TextField label="Fare type" name="altFareType" value={alt.fareType} onChange={(e) => setAlt({ ...alt, fareType: e.target.value })} />
              <TextField label="Departure" name="altDep" type="datetime-local" value={alt.flightDateTime} onChange={(e) => setAlt({ ...alt, flightDateTime: e.target.value })} />
              <TextField label="Arrival" name="altArr" type="datetime-local" value={alt.arrivalDateTime} onChange={(e) => setAlt({ ...alt, arrivalDateTime: e.target.value })} />
              <TextField label="Terminal" name="altTerminal" value={alt.terminal} onChange={(e) => setAlt({ ...alt, terminal: e.target.value })} />
              <TextField label="Reporting time" name="altReporting" value={alt.reportingTime} onChange={(e) => setAlt({ ...alt, reportingTime: e.target.value })} />
              <TextField label="Baggage" name="altBaggage" value={alt.baggageAllowance} onChange={(e) => setAlt({ ...alt, baggageAllowance: e.target.value })} />
              <TextField label="New selling price (₹)" name="altPrice" type="number" step="0.01" value={alt.sellingPrice} onChange={(e) => setAlt({ ...alt, sellingPrice: e.target.value })} required />
              <TextField label="Vendor cost (₹, internal)" name="altCost" type="number" step="0.01" value={alt.vendorCost} onChange={(e) => setAlt({ ...alt, vendorCost: e.target.value })} />
            </div>
          ) : null}
          <p className="text-xs text-ink-tertiary">
            Higher fare: the customer chooses to pay the difference or get a refund. Lower fare: the difference refund is raised automatically. Refunds still
            need approval in Refunds.
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={submitUnavailable}
              isLoading={pending === "UNAVAILABLE"}
              disabled={pending !== null || (!noAlternative && (alt.route.trim().length < 3 || !(Number(alt.sellingPrice) > 0)))}
            >
              Record unavailability
            </Button>
          </div>
        </div>
      ) : null}

      {!view.pnr ? (
        <div className="flex flex-col gap-3 border-t border-hairline pt-4">
          <p className="text-sm font-medium text-ink-heading">Record PNR</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="PNR" name="pnr" value={pnr.pnr} onChange={(e) => setPnr({ ...pnr, pnr: e.target.value })} required />
            <TextField label="Vendor reference" name="pnrVendorRef" value={pnr.vendorReference} onChange={(e) => setPnr({ ...pnr, vendorReference: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void run("PNR", { action: "RECORD_PNR", pnr: pnr.pnr.trim(), vendorReference: pnr.vendorReference.trim() || undefined })}
              isLoading={pending === "PNR"}
              disabled={pending !== null || pnr.pnr.trim().length < 4}
            >
              Record PNR
            </Button>
          </div>
        </div>
      ) : !view.ticketIssuedAt ? (
        <div className="flex flex-col gap-3 border-t border-hairline pt-4">
          <p className="text-sm font-medium text-ink-heading">Issue Ticket</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {view.tickets.map((t) => (
              <TextField
                key={t.passengerId}
                label={`Ticket number — ${t.fullName}`}
                name={`ticket-${t.passengerId}`}
                value={ticketNumbers[t.passengerId] ?? ""}
                onChange={(e) => setTicketNumbers({ ...ticketNumbers, [t.passengerId]: e.target.value })}
                required
              />
            ))}
            <TextField label="Issue time" name="issuedAt" type="datetime-local" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} hint="Defaults to now." />
            <TextField label="Baggage" name="ticketBaggage" value={baggage} onChange={(e) => setBaggage(e.target.value)} />
            <label className="flex flex-col gap-1 text-sm text-ink-secondary">
              Ticket PDF
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setTicketFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => void submitTicket()} isLoading={pending === "ISSUE_TICKET"} disabled={pending !== null || !allTicketNumbers || !ticketFile}>
              Issue & Deliver Ticket
            </Button>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1 border-t border-hairline pt-4 text-sm text-ink-secondary">
          {view.tickets.map((t) => (
            <li key={t.passengerId}>
              {t.fullName}: <span className="font-medium text-ink-primary">{t.ticketNumber ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
