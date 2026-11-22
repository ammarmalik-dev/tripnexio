"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField } from "@/components/forms/FormField";
import { FilePickerButton } from "@/components/forms/FilePickerButton";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

export interface StaffTicketFlowView {
  kind: "CUSTOMER" | "AIRLINE_CANCELLED" | "AIRLINE_RESCHEDULED";
  stage: string;
  passengerIds: string[];
  reason: string;
  paidShare?: number;
  airlineFee?: number;
  serviceCharge?: number;
  gst?: number;
  refundable?: number;
  newItinerary?: string;
  decision?: string | null;
}

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

const rupees = (value: number | undefined) => `₹${(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Client doc 16 Nov (A12–A14) — after the ticket is issued: Cancel Ticket (request → sent to airline → cancellation
 * quotation → the customer approves → refund → Ticket Cancelled), Cancelled by Airline (full refund) and Rescheduled
 * by Airline (the customer accepts → upload the new ticket, or refund). Never offered before a ticket is issued (A13).
 */
export function TicketFlowPanel({
  bookingId,
  flow,
  tickets,
  defaultServiceCharge,
  onChanged,
}: {
  bookingId: string;
  flow: StaffTicketFlowView | null;
  tickets: { passengerId: string; fullName: string; issued?: boolean; cancelled?: boolean }[];
  defaultServiceCharge: number;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [mode, setMode] = useState<"" | "REQUEST" | "AIRLINE_CANCELLED" | "AIRLINE_RESCHEDULED">("");
  const issued = tickets.filter((ticket) => ticket.issued && !ticket.cancelled);
  const [chosen, setChosen] = useState<string[]>(issued.map((ticket) => ticket.passengerId));
  const [reason, setReason] = useState("");
  const [newItinerary, setNewItinerary] = useState("");
  const [airlineFee, setAirlineFee] = useState("");
  const [serviceCharge, setServiceCharge] = useState(String(defaultServiceCharge));
  const [file, setFile] = useState<File | null>(null);
  const open = flow && flow.stage !== "DONE" && flow.stage !== "DECLINED";

  const send = async (key: string, body: Record<string, unknown>) => {
    setPending(key);
    try {
      const result = await postJson<{ message: string }>(`/api/bookings/${bookingId}/special-fare-action`, body);
      toast.success(result.message);
      setMode("");
      setReason("");
      setNewItinerary("");
      setAirlineFee("");
      setFile(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't complete this action. Please try again.");
    } finally {
      setPending(null);
    }
  };

  if (issued.length === 0 && !flow) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <h3 className="text-sm font-semibold text-ink-heading">Ticket cancellation / airline changes</h3>

      {open && flow ? (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
          {flow.kind === "CUSTOMER" ? (
            <>
              <p>
                Customer cancellation ({flow.passengerIds.length} passenger{flow.passengerIds.length === 1 ? "" : "s"}) — {flow.reason}.{" "}
                <span className="font-medium text-ink-primary">
                  {flow.stage === "REQUESTED"
                    ? "Next: send it to the airline."
                    : flow.stage === "SENT_TO_AIRLINE"
                      ? "Next: enter the airline's cancellation fee to quote the customer."
                      : flow.stage === "QUOTED"
                        ? "Waiting for the customer to approve the cancellation quotation."
                        : "Refund raised — the booking moves to Ticket Cancelled once the refund completes."}
                </span>
              </p>
              {flow.stage === "QUOTED" || flow.stage === "REFUND_RAISED" ? (
                <p>
                  Paid {rupees(flow.paidShare)} · airline fee {rupees(flow.airlineFee)} · service charge {rupees(flow.serviceCharge)} (company profit) · GST {rupees(flow.gst)} ·{" "}
                  <span className="font-semibold text-ink-primary">refund {rupees(flow.refundable)}</span>
                </p>
              ) : null}
              {flow.stage === "REQUESTED" ? (
                <div>
                  <Button type="button" size="sm" onClick={() => void send("SENT", { action: "TICKET_FLOW", flow: { step: "SENT_TO_AIRLINE" } })} isLoading={pending === "SENT"} disabled={pending !== null}>
                    Sent to Airline for Cancellation
                  </Button>
                </div>
              ) : null}
              {flow.stage === "SENT_TO_AIRLINE" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                  <TextField label="Airline cancellation fee (₹)" name="airlineFee" type="number" min={0} step="0.01" value={airlineFee} onChange={(e) => setAirlineFee(e.target.value)} />
                  <TextField
                    label="Service charge (₹)"
                    name="serviceCharge"
                    type="number"
                    min={0}
                    step="0.01"
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(e.target.value)}
                    hint="From Admin → Refund config; GST is added on it."
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void send("QUOTE", { action: "TICKET_FLOW", flow: { step: "QUOTE", airlineFee: Number(airlineFee), serviceCharge: Number(serviceCharge || 0) } })}
                    isLoading={pending === "QUOTE"}
                    disabled={pending !== null || airlineFee.trim() === ""}
                  >
                    Send Cancellation Quotation
                  </Button>
                </div>
              ) : null}
            </>
          ) : flow.kind === "AIRLINE_RESCHEDULED" ? (
            <>
              <p>
                Rescheduled by the airline — new schedule: {flow.newItinerary}.{" "}
                <span className="font-medium text-ink-primary">
                  {flow.stage === "AWAITING_CUSTOMER"
                    ? "Waiting for the customer to accept or request a refund."
                    : flow.stage === "ACCEPTED_NEW"
                      ? "The customer accepted — upload the new ticket."
                      : "The customer requested a refund (raised)."}
                </span>
              </p>
              {flow.stage === "ACCEPTED_NEW" ? (
                <div className="flex flex-wrap items-end gap-3">
                  <FormField label="New ticket (PDF, PNG or JPG)" htmlFor={`resched-${bookingId}`}>
                    <FilePickerButton id={`resched-${bookingId}`} accept={ALLOWED.join(",")} fileName={file?.name ?? null} onFile={setFile} disabled={pending !== null} />
                  </FormField>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      if (!file) return;
                      if (!ALLOWED.includes(file.type)) {
                        toast.error("Use a PDF, PNG or JPG ticket file.");
                        return;
                      }
                      await send("RESCHED", { action: "RESCHEDULE_TICKET", fileBase64: await readAsBase64(file) });
                    }}
                    isLoading={pending === "RESCHED"}
                    disabled={pending !== null || !file}
                  >
                    Upload &amp; Deliver New Ticket
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p>Cancelled by the airline — {flow.reason}. The full refund was raised.</p>
          )}
        </div>
      ) : issued.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(mode === "REQUEST" ? "" : "REQUEST")} disabled={pending !== null}>
              Cancel Ticket…
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(mode === "AIRLINE_CANCELLED" ? "" : "AIRLINE_CANCELLED")} disabled={pending !== null}>
              Cancelled by Airline…
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(mode === "AIRLINE_RESCHEDULED" ? "" : "AIRLINE_RESCHEDULED")} disabled={pending !== null}>
              Rescheduled by Airline…
            </Button>
          </div>
          {mode ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-glass-border bg-surface-2 p-4">
              {mode === "REQUEST" && issued.length > 1 ? (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs text-ink-secondary">Cancel the ticket of:</legend>
                  {issued.map((ticket) => (
                    <label key={ticket.passengerId} className="flex items-center gap-2 text-sm text-ink-primary">
                      <input
                        type="checkbox"
                        checked={chosen.includes(ticket.passengerId)}
                        onChange={() => setChosen((current) => (current.includes(ticket.passengerId) ? current.filter((id) => id !== ticket.passengerId) : [...current, ticket.passengerId]))}
                      />
                      {ticket.fullName}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {mode === "AIRLINE_RESCHEDULED" ? (
                <TextField label="New schedule (flight, date, times)" name="newItinerary" value={newItinerary} onChange={(e) => setNewItinerary(e.target.value)} />
              ) : null}
              <TextField
                label={mode === "REQUEST" ? "Reason for the cancellation" : mode === "AIRLINE_CANCELLED" ? "Airline's reason" : "Note (optional)"}
                name="ticketFlowReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div>
                <Button
                  type="button"
                  size="sm"
                  isLoading={pending === mode}
                  disabled={pending !== null || (mode === "REQUEST" && (chosen.length === 0 || reason.trim().length < 3)) || (mode === "AIRLINE_CANCELLED" && reason.trim().length < 3) || (mode === "AIRLINE_RESCHEDULED" && newItinerary.trim().length < 5)}
                  onClick={() =>
                    void send(mode, {
                      action: "TICKET_FLOW",
                      flow:
                        mode === "REQUEST"
                          ? { step: "REQUEST", passengerIds: chosen, reason: reason.trim() }
                          : mode === "AIRLINE_CANCELLED"
                            ? { step: "AIRLINE_CANCELLED", reason: reason.trim() }
                            : { step: "AIRLINE_RESCHEDULED", newItinerary: newItinerary.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}) },
                    })
                  }
                >
                  {mode === "REQUEST" ? "Request Ticket Cancellation" : mode === "AIRLINE_CANCELLED" ? "Mark Cancelled by Airline & Raise Full Refund" : "Send New Schedule to Customer"}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
