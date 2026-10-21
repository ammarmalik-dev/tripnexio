"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField } from "@/components/forms/FormField";
import { FilePickerButton } from "@/components/forms/FilePickerButton";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { SpecialFareAlternativeForm } from "./SpecialFareAlternativeForm";

export interface SpecialFareBookingView {
  finalConfirmedAt: string | null;
  alternativeOffer: {
    route?: string | null;
    airline?: string | null;
    flightNumber?: string | null;
    sellingPrice?: number;
    vendorCost?: number | null;
    vendorName?: string | null;
    direction: "HIGHER" | "LOWER" | "SAME" | "NONE";
    difference: number;
    decision: "PAY" | "REFUND" | null;
  } | null;
  pnr: string | null;
  pnrVendorReference: string | null;
  pnrRecordedAt: string | null;
  ticketIssuedAt: string | null;
  ticketBaggage: string | null;
  /** The selected quote's baggage — the ticket step starts from it. */
  quoteBaggage: string | null;
  quoteVendorReference: string | null;
  /** Client doc 2026-10-20 (A8) — each passenger's ticket: issued or still pending. */
  tickets: { passengerId: string; fullName: string; ticketNumber: string | null; issued?: boolean }[];
  /** Client doc 2026-10-20 (A10) — false once a ticket is delivered (only an Admin may then mark it unavailable). */
  canMarkUnavailable?: boolean;
  /** Client 2026-10-21 — the alternative uses the quote form: traveller counts + the paid quote's airports. */
  paxCounts?: { adult: number; child: number; infant: number };
  quoteFromAirport?: string | null;
  quoteToAirport?: string | null;
}

interface AirportOption {
  code: string;
  name: string;
  city: string;
  country: string;
}
interface NamedOption {
  id: string;
  code?: string;
  name: string;
}

const ALLOWED_TICKET_TYPES = ["application/pdf", "image/png", "image/jpeg"];
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

/**
 * P16 — Flight Special Fare post-payment operations on Booking detail. Client doc 2026-10-20:
 * - Unavailable → the alternative is entered on the quote's own form (SpecialFareAlternativeForm:
 *   sectors, fare rules, cancellation, cost + price per passenger type, the vendor) (A12); once a
 *   ticket was delivered only an Admin can mark the flight unavailable (A10).
 * - Record PNR — the PNR only (A7).
 * - Issue Ticket — upload the ticket for the passengers it covers; each passenger shows Issued /
 *   Pending until everyone has theirs, then the booking is "Ticket Issued" (A8). One delivery
 *   option, a coloured Choose File button (A9).
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
  const [pnr, setPnr] = useState("");
  const [baggage, setBaggage] = useState(view.quoteBaggage ?? "");
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [ticketFor, setTicketFor] = useState<string[]>([]);
  const [options, setOptions] = useState<{ airports: AirportOption[]; airlines: NamedOption[]; vendors: NamedOption[] } | null>(null);

  // The alternative form's lists (Airport / Airline masters, Special Fare vendors), loaded when it opens.
  useEffect(() => {
    if (!showAlternative || options) return;
    let cancelled = false;
    async function load() {
      try {
        const [airports, airlines, vendors] = await Promise.all([
          getJson<AirportOption[]>("/api/crm/airports"),
          getJson<NamedOption[]>("/api/airlines"),
          getJson<NamedOption[]>("/api/vendors?service=FLIGHT_SPECIAL_FARE"),
        ]);
        if (!cancelled) setOptions({ airports, airlines, vendors });
      } catch {
        if (!cancelled) setOptions({ airports: [], airlines: [], vendors: [] });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [showAlternative, options]);

  const run = async (key: string, body: Record<string, unknown>) => {
    setPending(key);
    try {
      const result = await postJson<{ message: string }>(`/api/bookings/${bookingId}/special-fare-action`, body);
      toast.success(result.message);
      setShowAlternative(false);
      setTicketFile(null);
      setTicketFor([]);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't complete this action. Please try again.");
    } finally {
      setPending(null);
    }
  };

  const submitUnavailable = (alternative: Record<string, unknown> | null) => void run("UNAVAILABLE", { action: "UNAVAILABLE", alternative });

  const pendingTickets = view.tickets.filter((ticket) => !ticket.issued);
  const chosen = view.tickets.length <= 1 || pendingTickets.length === 1 ? pendingTickets.map((ticket) => ticket.passengerId) : ticketFor;

  const submitTicket = async () => {
    if (!ticketFile || chosen.length === 0) return;
    if (!ALLOWED_TICKET_TYPES.includes(ticketFile.type)) {
      toast.error("Use a PDF, PNG or JPG ticket file.");
      return;
    }
    if (ticketFile.size > MAX_FILE_BYTES) {
      toast.error("The ticket file is too large (8MB max).");
      return;
    }
    await run("ISSUE_TICKET", { action: "ISSUE_TICKET", passengerIds: chosen, baggage: baggage.trim() || undefined, fileBase64: await readAsBase64(ticketFile) });
  };

  const offer = view.alternativeOffer;

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
          <dd className="font-medium text-ink-primary">{view.pnr ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Tickets</dt>
          <dd className="flex flex-col gap-0.5">
            {view.tickets.map((ticket) => (
              <span key={ticket.passengerId} className="flex items-center gap-2 text-ink-primary">
                {ticket.fullName}
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ticket.issued ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                  {ticket.issued ? "Issued" : "Pending"}
                </span>
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {offer ? (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
          {offer.direction === "NONE"
            ? "Flight unavailable — no suitable alternative; full refund raised."
            : `Alternative ${[offer.airline, offer.flightNumber].filter(Boolean).join(" ")} ${offer.route ?? ""} at ₹${offer.sellingPrice ?? "—"}${offer.vendorCost != null ? ` (cost ₹${offer.vendorCost}${offer.vendorName ? `, ${offer.vendorName}` : ""} — internal)` : ""} — ${
                offer.direction === "HIGHER" ? `₹${offer.difference} higher` : offer.direction === "LOWER" ? `₹${-offer.difference} lower (difference refund raised)` : "same fare"
              }${offer.direction === "HIGHER" ? ` · customer: ${offer.decision === "PAY" ? "paying the difference" : offer.decision === "REFUND" ? "requested refund" : "not decided yet"}` : ""}`}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="glass" onClick={() => void run("CONFIRM", { action: "CONFIRM_AVAILABILITY" })} isLoading={pending === "CONFIRM"} disabled={pending !== null}>
          Confirm Availability
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAlternative((v) => !v)} disabled={pending !== null || view.canMarkUnavailable === false}>
          Unavailable…
        </Button>
        {view.canMarkUnavailable === false ? <span className="text-xs text-ink-tertiary">A ticket was delivered — only an Admin can mark it unavailable.</span> : null}
      </div>

      {showAlternative ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-glass-border bg-surface-2 p-4">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={noAlternative} onChange={(e) => setNoAlternative(e.target.checked)} />
            No suitable alternative (full refund)
          </label>
          {!noAlternative ? (
            options ? (
              <SpecialFareAlternativeForm
                bookingId={bookingId}
                airports={options.airports}
                airlines={options.airlines}
                vendors={options.vendors}
                paxCounts={view.paxCounts ?? { adult: Math.max(1, view.tickets.length), child: 0, infant: 0 }}
                startFrom={{ from: view.quoteFromAirport ?? null, to: view.quoteToAirport ?? null }}
                pending={pending !== null}
                onSubmit={submitUnavailable}
              />
            ) : (
              <p className="text-sm text-ink-tertiary">Loading the form…</p>
            )
          ) : null}
          <p className="text-xs text-ink-tertiary">
            Higher fare: the customer chooses to pay the difference or get a refund. Lower fare: the difference refund is raised automatically. Refunds still
            need approval in Refunds.
          </p>
          {noAlternative ? (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => submitUnavailable(null)} isLoading={pending === "UNAVAILABLE"} disabled={pending !== null}>
                Record unavailability
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!view.pnr ? (
        <div className="flex flex-col gap-3 border-t border-hairline pt-4">
          <p className="text-sm font-medium text-ink-heading">Record PNR</p>
          <div className="flex flex-wrap items-end gap-3">
            <TextField label="PNR" name="pnr" value={pnr} onChange={(e) => setPnr(e.target.value)} required className="sm:max-w-xs" />
            <Button
              type="button"
              size="sm"
              onClick={() => void run("PNR", { action: "RECORD_PNR", pnr: pnr.trim() })}
              isLoading={pending === "PNR"}
              disabled={pending !== null || pnr.trim().length < 4}
            >
              Record PNR
            </Button>
          </div>
        </div>
      ) : pendingTickets.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-hairline pt-4">
          <p className="text-sm font-medium text-ink-heading">Issue Ticket</p>
          {view.tickets.length > 1 && pendingTickets.length > 1 ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs text-ink-secondary">This ticket file is for (tick one or more — upload only the tickets issued so far):</legend>
              {pendingTickets.map((ticket) => (
                <label key={ticket.passengerId} className="flex items-center gap-2 text-sm text-ink-primary">
                  <input
                    type="checkbox"
                    checked={ticketFor.includes(ticket.passengerId)}
                    onChange={() =>
                      setTicketFor((current) => (current.includes(ticket.passengerId) ? current.filter((id) => id !== ticket.passengerId) : [...current, ticket.passengerId]))
                    }
                  />
                  {ticket.fullName}
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Baggage" name="ticketBaggage" value={baggage} onChange={(e) => setBaggage(e.target.value)} hint="From the quote — change only if it's different." />
            <FormField label="Ticket file (PDF, PNG or JPG)" htmlFor={`sf-ticket-${bookingId}`}>
              <FilePickerButton id={`sf-ticket-${bookingId}`} accept={ALLOWED_TICKET_TYPES.join(",")} fileName={ticketFile?.name ?? null} onFile={setTicketFile} disabled={pending !== null} />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => void submitTicket()} isLoading={pending === "ISSUE_TICKET"} disabled={pending !== null || !ticketFile || chosen.length === 0}>
              Upload &amp; Deliver Ticket
            </Button>
          </div>
        </div>
      ) : (
        <p className="border-t border-hairline pt-4 text-sm text-ink-secondary">Every passenger&apos;s ticket has been delivered{view.ticketIssuedAt ? ` (${fmt(view.ticketIssuedAt)})` : ""}.</p>
      )}
    </section>
  );
}
