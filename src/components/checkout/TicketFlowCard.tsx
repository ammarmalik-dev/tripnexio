"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { formatRupees } from "@/lib/return-ticket/use-return-ticket-destinations";

export interface TicketFlowView {
  kind: "CUSTOMER" | "AIRLINE_CANCELLED" | "AIRLINE_RESCHEDULED";
  stage: string;
  waiting: boolean;
  refundable: number | null;
  newItinerary: string | null;
  charges: { paid: number; airlineFee: number; serviceCharge: number; gst: number } | null;
}

/**
 * Client doc 16 Nov (A12 / A14) — on the booking page: the ticket cancellation quotation (charges and the final
 * refundable amount, Approve / Keep my ticket) or the airline's new schedule (Accept new flight / Request refund).
 */
export function TicketFlowCard({ token, flow, onChanged }: { token: string; flow: TicketFlowView; onChanged: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const choose = async (choice: "ACCEPT" | "DECLINE" | "REFUND") => {
    setPending(choice);
    try {
      const result = await postJson<{ message: string }>(`/api/pay/${token}/ticket-flow`, { choice });
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your choice. Please try again.");
    } finally {
      setPending(null);
      onChanged();
    }
  };

  const title =
    flow.kind === "CUSTOMER" ? "Ticket cancellation" : flow.kind === "AIRLINE_RESCHEDULED" ? "Your flight was rescheduled by the airline" : "Your flight was cancelled by the airline";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-5" aria-labelledby="ticket-flow-title">
      <h2 id="ticket-flow-title" className="flex items-center gap-2 text-base font-semibold text-ink-heading">
        <Info className="h-4 w-4 text-ink-accent" aria-hidden="true" />
        {title}
      </h2>

      {flow.kind === "CUSTOMER" && flow.waiting && flow.charges ? (
        <>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-ink-secondary">Amount paid for these tickets</dt>
            <dd className="text-right text-ink-primary">{formatRupees(flow.charges.paid)}</dd>
            <dt className="text-ink-secondary">Airline cancellation fee</dt>
            <dd className="text-right text-ink-primary">− {formatRupees(flow.charges.airlineFee)}</dd>
            <dt className="text-ink-secondary">Service charge</dt>
            <dd className="text-right text-ink-primary">− {formatRupees(flow.charges.serviceCharge)}</dd>
            <dt className="text-ink-secondary">GST on service charge</dt>
            <dd className="text-right text-ink-primary">− {formatRupees(flow.charges.gst)}</dd>
            <dt className="border-t border-hairline pt-1 font-semibold text-ink-heading">Refund to you</dt>
            <dd className="border-t border-hairline pt-1 text-right font-semibold text-ink-heading">{formatRupees(flow.refundable ?? 0)}</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void choose("ACCEPT")} isLoading={pending === "ACCEPT"} disabled={pending !== null}>
              Approve Cancellation &amp; Refund
            </Button>
            <Button type="button" variant="ghost" onClick={() => void choose("DECLINE")} isLoading={pending === "DECLINE"} disabled={pending !== null}>
              Keep My Ticket
            </Button>
          </div>
        </>
      ) : flow.kind === "AIRLINE_RESCHEDULED" && flow.waiting ? (
        <>
          <p className="text-sm text-ink-primary">New schedule: {flow.newItinerary}</p>
          <p className="text-sm text-ink-secondary">Accept the new flight and we&apos;ll send your updated ticket, or request a full refund.</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void choose("ACCEPT")} isLoading={pending === "ACCEPT"} disabled={pending !== null}>
              Accept New Flight
            </Button>
            <Button type="button" variant="ghost" onClick={() => void choose("REFUND")} isLoading={pending === "REFUND"} disabled={pending !== null}>
              Request Refund
            </Button>
          </div>
        </>
      ) : flow.stage === "ACCEPTED_NEW" ? (
        <p className="text-sm text-ink-primary">You accepted the new schedule — your updated ticket will be sent shortly.</p>
      ) : flow.stage === "DONE" && flow.kind === "CUSTOMER" ? (
        <p className="text-sm text-ink-primary">Your ticket is cancelled and the refund{flow.refundable ? ` of ${formatRupees(flow.refundable)}` : ""} is complete.</p>
      ) : (
        <p className="text-sm text-ink-primary">Your refund{flow.kind === "CUSTOMER" && flow.refundable ? ` of ${formatRupees(flow.refundable)}` : ""} is being processed.</p>
      )}
    </section>
  );
}
