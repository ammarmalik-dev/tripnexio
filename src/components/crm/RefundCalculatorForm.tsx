"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/components/forms/TextField";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { createRefundSchema, type CreateRefundValues } from "@/lib/validation/refund-schema";
import { computeRefundAmount, SAMPLE_OTB_FIXED_SERVICE_CHARGE } from "@/lib/refunds/pricing";
import type { ServiceType } from "../../generated/prisma/enums";

interface RefundCalculatorFormProps {
  serviceType: ServiceType;
  defaultPaidAmount: number;
  onSubmit: (values: CreateRefundValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

export function RefundCalculatorForm({
  serviceType,
  defaultPaidAmount,
  onSubmit,
  onCancel,
  submitting,
}: RefundCalculatorFormProps) {
  const isOtb = serviceType === "OTB";
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateRefundValues>({
    resolver: zodResolver(createRefundSchema),
    defaultValues: { paidAmount: defaultPaidAmount, cancellationCharge: 0, gatewayCharge: 0, otbValidated: false },
  });

  const numberField = (name: "paidAmount" | "cancellationCharge" | "gatewayCharge") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });

  const watched = watch();
  const previewAmount = computeRefundAmount(serviceType, {
    paidAmount: Number(watched.paidAmount) || 0,
    cancellationCharge: Number(watched.cancellationCharge) || 0,
    gatewayCharge: Number(watched.gatewayCharge) || 0,
    otbValidated: watched.otbValidated,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-4">
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

      {isOtb ? (
        <label className="flex items-start gap-2 text-sm text-ink-secondary">
          <input type="checkbox" className="mt-0.5" {...register("otbValidated")} />
          <span>
            OTB already validated with the airline — deduct the fixed service charge (SAMPLE ₹
            {SAMPLE_OTB_FIXED_SERVICE_CHARGE}, pending the real figure from the OTB spec).
          </span>
        </label>
      ) : null}

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
