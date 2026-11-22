"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { formatRupees } from "@/lib/return-ticket/use-return-ticket-destinations";

export interface SpecialFareAlternativeView {
  airline: string | null;
  flightNumber: string | null;
  route: string | null;
  flightDateTime: string | null;
  arrivalDateTime: string | null;
  baggageAllowance: string | null;
  terminal: string | null;
  reportingTime: string | null;
  fareType: string | null;
  /** Client 2026-10-21 — the alternative is entered like a quote: its sectors, fare rules and cancellation terms. */
  itinerary?: { from: string; to: string; departAt?: string; arriveAt?: string; airline?: string; flightNumber?: string }[];
  fareRules?: string | null;
  cancellationAllowed?: boolean | null;
  cancellationCharge?: number | null;
  noShowCharge?: number | null;
  customerCancellationPolicy?: string | null;
  direction: "HIGHER" | "LOWER" | "SAME" | "NONE";
  difference: number;
  decision: "PAY" | "ACCEPT" | "REFUND" | null;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * P16 — Flight_Special_Fare.md §18 on the booking's payment page: the paid flight became unavailable.
 * Client doc 16 Nov (A11) — the customer always chooses: Approve Alternative (a higher fare: pay the difference; a
 * lower fare: the difference is refunded) or Request Refund. With no alternative yet, only Request Refund.
 */
export function SpecialFareAlternativeCard({ token, offer, onChanged }: { token: string; offer: SpecialFareAlternativeView; onChanged: () => void }) {
  const [pending, setPending] = useState<"PAY" | "ACCEPT" | "REFUND" | null>(null);

  const choose = async (choice: "PAY" | "ACCEPT" | "REFUND") => {
    setPending(choice);
    try {
      const result = await postJson<{ message: string }>(`/api/pay/${token}/special-fare-choice`, { choice });
      toast.success(choice === "REFUND" ? "Your refund request was raised. Our team will process it." : result.message);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save your choice. Please try again.");
      onChanged();
    } finally {
      setPending(null);
    }
  };

  const flight = [offer.airline, offer.flightNumber].filter(Boolean).join(" ");
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-5" aria-labelledby="alt-offer-title">
      <h2 id="alt-offer-title" className="flex items-center gap-2 text-base font-semibold text-ink-heading">
        <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
        Your original flight is no longer available
      </h2>
      <div className="flex flex-col gap-1 text-sm text-ink-secondary">
        <p className="font-medium text-ink-primary">
          {offer.direction === "NONE" ? "No alternative yet" : "Alternative option"}
          {flight ? `: ${flight}` : ""}
          {offer.route ? ` · ${offer.route}` : ""}
        </p>
        {offer.flightDateTime ? (
          <p>
            Departs {formatDateTime(offer.flightDateTime)}
            {offer.arrivalDateTime ? ` · Arrives ${formatDateTime(offer.arrivalDateTime)}` : ""}
          </p>
        ) : null}
        {offer.terminal ? <p>Terminal: {offer.terminal}</p> : null}
        {offer.reportingTime ? <p>Reporting time: {offer.reportingTime}</p> : null}
        {offer.baggageAllowance ? <p>Baggage: {offer.baggageAllowance}</p> : null}
        {offer.itinerary && offer.itinerary.length > 1 ? (
          <ol className="mt-1 flex flex-col gap-0.5">
            {offer.itinerary.map((sector, index) => (
              <li key={`${sector.from}-${sector.to}-${index}`}>
                Sector {index + 1}: {sector.from} → {sector.to}
                {sector.airline || sector.flightNumber ? ` · ${[sector.airline, sector.flightNumber].filter(Boolean).join(" ")}` : ""}
                {sector.departAt ? ` · ${formatDateTime(sector.departAt)}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
        {offer.fareRules ? <p>Fare rules: {offer.fareRules}</p> : null}
        {offer.cancellationAllowed === false ? (
          <p>Cancellation: non-refundable</p>
        ) : offer.cancellationCharge != null || offer.noShowCharge != null ? (
          <p>
            {offer.cancellationCharge != null ? `Cancellation charge: ${formatRupees(offer.cancellationCharge)}` : ""}
            {offer.cancellationCharge != null && offer.noShowCharge != null ? " · " : ""}
            {offer.noShowCharge != null ? `No-show charge: ${formatRupees(offer.noShowCharge)}` : ""}
          </p>
        ) : null}
        {offer.customerCancellationPolicy ? <p>{offer.customerCancellationPolicy}</p> : null}
      </div>

      {offer.decision === "PAY" ? (
        <p className="text-sm text-ink-primary">You approved the alternative. Once the additional payment is received we&apos;ll issue your ticket.</p>
      ) : offer.decision === "ACCEPT" ? (
        <p className="text-sm text-ink-primary">
          You approved the alternative — we&apos;re booking it{offer.direction === "LOWER" ? ` and refunding the ${formatRupees(-offer.difference)} difference` : ""}.
        </p>
      ) : offer.decision === "REFUND" ? (
        <p className="text-sm text-ink-primary">You requested a refund. Our team is processing it.</p>
      ) : (
        <>
          <p className="text-sm text-ink-primary">
            {offer.direction === "NONE" ? (
              <>Our team is looking for an alternative flight. If you&apos;d rather not wait, you can request a full refund now.</>
            ) : offer.direction === "HIGHER" ? (
              <>
                This alternative costs <span className="font-semibold">{formatRupees(offer.difference)}</span> more (plus applicable GST and gateway fee). Approve
                it and pay the difference, or request a full refund — the choice is yours.
              </>
            ) : offer.direction === "LOWER" ? (
              <>
                This alternative costs <span className="font-semibold">{formatRupees(-offer.difference)}</span> less — approve it and the difference is refunded to
                you, or request a full refund instead.
              </>
            ) : (
              <>This alternative is at the same fare. Approve it, or request a full refund instead — the choice is yours.</>
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            {offer.direction !== "NONE" ? (
              <Button
                type="button"
                onClick={() => void choose(offer.direction === "HIGHER" ? "PAY" : "ACCEPT")}
                isLoading={pending === "PAY" || pending === "ACCEPT"}
                disabled={pending !== null}
              >
                {offer.direction === "HIGHER" ? "Approve & Pay Difference" : "Approve Alternative"}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => void choose("REFUND")} isLoading={pending === "REFUND"} disabled={pending !== null}>
              Request Refund
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
