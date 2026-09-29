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
  direction: "HIGHER" | "LOWER" | "SAME";
  difference: number;
  decision: "PAY" | "REFUND" | null;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * P16 — Flight_Special_Fare.md §18 on the booking's payment page: the paid
 * flight became unavailable. For a higher-fare alternative the customer
 * chooses "Pay Additional Amount" or "Request Refund" — never forced into
 * the higher fare. Lower/same-fare alternatives are shown for information
 * (a lower fare's difference is refunded automatically).
 */
export function SpecialFareAlternativeCard({ token, offer, onChanged }: { token: string; offer: SpecialFareAlternativeView; onChanged: () => void }) {
  const [pending, setPending] = useState<"PAY" | "REFUND" | null>(null);

  const choose = async (choice: "PAY" | "REFUND") => {
    setPending(choice);
    try {
      await postJson(`/api/pay/${token}/special-fare-choice`, { choice });
      toast.success(choice === "PAY" ? "Great — please complete the additional payment below." : "Your refund request was raised. Our team will process it.");
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
          Alternative option{flight ? `: ${flight}` : ""}
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
      </div>

      {offer.direction === "HIGHER" && !offer.decision ? (
        <>
          <p className="text-sm text-ink-primary">
            This alternative costs <span className="font-semibold">{formatRupees(offer.difference)}</span> more (plus applicable GST and gateway fee). You
            can pay the additional amount, or request a full refund instead — the choice is yours.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void choose("PAY")} isLoading={pending === "PAY"} disabled={pending !== null}>
              Pay Additional Amount
            </Button>
            <Button type="button" variant="ghost" onClick={() => void choose("REFUND")} isLoading={pending === "REFUND"} disabled={pending !== null}>
              Request Refund
            </Button>
          </div>
        </>
      ) : offer.decision === "PAY" ? (
        <p className="text-sm text-ink-primary">You chose the alternative. Once the additional payment is received we&apos;ll issue your ticket.</p>
      ) : offer.decision === "REFUND" ? (
        <p className="text-sm text-ink-primary">You requested a refund. Our team is processing it.</p>
      ) : offer.direction === "LOWER" ? (
        <p className="text-sm text-ink-primary">
          We&apos;ve booked the alternative for you. It costs {formatRupees(-offer.difference)} less, and the difference is being refunded.
        </p>
      ) : (
        <p className="text-sm text-ink-primary">We&apos;ve booked the alternative for you at the same fare.</p>
      )}
    </section>
  );
}
