"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { createRefundSchema, type CreateRefundValues } from "@/lib/validation/refund-schema";
import { computeRefundAmount } from "@/lib/refunds/pricing";
import type { RefundRuleResult } from "@/lib/refunds/rules";

interface RefundCalculatorFormProps {
  defaultPaidAmount: number;
  /** Step 15 (audit §7.4) — the applicable per-service refund rule, computed server-side (see GET /api/bookings/[id]). Always `allowed` here — PaymentPanel hides this form entirely when it isn't. */
  refundRule: RefundRuleResult;
  /** This booking's own passengers — CRM.md §21 (Step 14) passenger-level partial refund selection. Empty selection = whole-booking refund, unchanged from before this step. */
  passengers: { id: string; fullName: string }[];
  onSubmit: (values: CreateRefundValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

export function RefundCalculatorForm({
  defaultPaidAmount,
  refundRule,
  passengers,
  onSubmit,
  onCancel,
  submitting,
}: RefundCalculatorFormProps) {
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateRefundValues>({
    resolver: zodResolver(createRefundSchema),
    defaultValues: { paidAmount: defaultPaidAmount, cancellationCharge: 0, gatewayCharge: 0 },
  });

  const togglePassenger = (id: string) => {
    setSelectedPassengerIds((current) => (current.includes(id) ? current.filter((pid) => pid !== id) : [...current, id]));
  };

  const submitWithPassengers = (values: CreateRefundValues) => onSubmit({ ...values, passengerIds: selectedPassengerIds });

  const numberField = (name: "paidAmount" | "cancellationCharge" | "gatewayCharge") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });

  const watched = watch();
  const paidAmount = Number(watched.paidAmount) || 0;
  const cancellationCharge = Number(watched.cancellationCharge) || 0;
  const gatewayCharge = Number(watched.gatewayCharge) || 0;
  const previewAmount = computeRefundAmount({
    paidAmount,
    cancellationCharge,
    gatewayCharge,
    fixedDeduction: refundRule.fixedDeduction,
  });

  return (
    <form onSubmit={handleSubmit(submitWithPassengers)} className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex items-start gap-2 rounded-md bg-accent/[0.06] px-3 py-2.5 text-xs text-ink-secondary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-accent" aria-hidden="true" />
        <span>{refundRule.label}</span>
      </div>

      {passengers.length > 0 ? (
        <FormField label="Applies to" htmlFor="refund-passengers">
          <div id="refund-passengers" className="flex flex-col gap-1.5">
            <p className="text-xs text-ink-tertiary">
              Leave everyone unchecked for a whole-booking refund, or select specific passenger(s) for a
              passenger-level partial refund.
            </p>
            <div className="flex flex-wrap gap-3">
              {passengers.map((passenger) => (
                <label key={passenger.id} className="flex items-center gap-1.5 text-sm text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={selectedPassengerIds.includes(passenger.id)}
                    onChange={() => togglePassenger(passenger.id)}
                  />
                  {passenger.fullName}
                </label>
              ))}
            </div>
            {selectedPassengerIds.length > 0 ? (
              <p className="text-xs font-medium text-ink-primary">
                Selected:{" "}
                {passengers
                  .filter((passenger) => selectedPassengerIds.includes(passenger.id))
                  .map((passenger) => passenger.fullName)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </FormField>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          label="Paid Amount (₹)"
          type="number"
          step="0.01"
          required
          {...numberField("paidAmount")}
          error={errors.paidAmount?.message}
        />
        <TextField
          label="Cancellation Charge (₹)"
          type="number"
          step="0.01"
          required
          {...numberField("cancellationCharge")}
          error={errors.cancellationCharge?.message}
        />
        <TextField
          label="Gateway Charge (₹)"
          type="number"
          step="0.01"
          required
          {...numberField("gatewayCharge")}
          error={errors.gatewayCharge?.message}
        />
      </div>

      <TextField
        label="Reason"
        placeholder="e.g. Customer cancelled travel plans"
        {...register("reason", { setValueAs: (value: string) => (value === "" ? undefined : value) })}
        error={errors.reason?.message}
      />

      <FormField label="Refund Amount (computed)" htmlFor="refund-preview">
        <div id="refund-preview" className="rounded-md border border-hairline bg-surface-2 px-3.5 py-2.5 text-lg font-semibold text-ink-heading">
          ₹{previewAmount.toLocaleString("en-IN")}
        </div>
        {refundRule.fixedDeduction > 0 ? (
          <p className="mt-1.5 text-xs text-ink-tertiary">
            = ₹{paidAmount.toLocaleString("en-IN")} paid − ₹{cancellationCharge.toLocaleString("en-IN")} cancellation −
            ₹{gatewayCharge.toLocaleString("en-IN")} gateway − ₹{refundRule.fixedDeduction.toLocaleString("en-IN")}{" "}
            rule deduction
          </p>
        ) : null}
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={submitting}>
          Record Refund
        </Button>
      </div>
    </form>
  );
}
