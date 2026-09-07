"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { RefundStatusControl } from "./RefundStatusControl";
import { RefundCalculatorForm } from "./RefundCalculatorForm";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import type { CreateRefundValues } from "@/lib/validation/refund-schema";
import type { PaymentStatus, RefundStatus, ServiceType } from "../../generated/prisma/enums";

export interface RefundData {
  id: string;
  paidAmount: string;
  cancellationCharge: string;
  gatewayCharge: string;
  refundAmount: string;
  reason: string | null;
  status: RefundStatus;
  createdAt: string;
}

export interface PaymentData {
  id: string;
  amount: string;
  gstAmount: string;
  gatewayFee: string;
  status: PaymentStatus;
  gatewayRef: string | null;
  paymentLink: string | null;
  linkExpiresAt: string | null;
  createdAt: string;
  refunds: RefundData[];
}

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function PaymentPanel({
  payment,
  serviceType,
  onChanged,
}: {
  payment: PaymentData;
  serviceType: ServiceType;
  onChanged: () => void;
}) {
  const [markingSuccess, setMarkingSuccess] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [creatingRefund, setCreatingRefund] = useState(false);
  const [refundStatuses, setRefundStatuses] = useState<Record<string, RefundStatus>>({});

  const total = Number(payment.amount) + Number(payment.gstAmount) + Number(payment.gatewayFee);

  const handleMarkSuccess = async () => {
    setMarkingSuccess(true);
    try {
      await postJson(`/api/payments/${payment.id}/mark-success`, {});
      toast.success("Payment marked successful.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't mark this payment successful. Please try again.");
    } finally {
      setMarkingSuccess(false);
    }
  };

  const handleCreateRefund = async (values: CreateRefundValues) => {
    setCreatingRefund(true);
    try {
      await postJson(`/api/payments/${payment.id}/refunds`, values);
      toast.success("Refund calculated and recorded.");
      setShowRefundForm(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't record this refund. Please try again.");
    } finally {
      setCreatingRefund(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PaymentStatusBadge status={payment.status} />
        <span className="text-xs text-ink-tertiary">
          {new Date(payment.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          {payment.gatewayRef ? ` · Ref: ${payment.gatewayRef}` : ""}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
        <div className="flex flex-col">
          <dt className="text-xs text-ink-tertiary">Base</dt>
          <dd className="font-medium text-ink-primary">{money(payment.amount)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-ink-tertiary">GST</dt>
          <dd className="font-medium text-ink-primary">{money(payment.gstAmount)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-ink-tertiary">Gateway Fee</dt>
          <dd className="font-medium text-ink-primary">{money(payment.gatewayFee)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-ink-tertiary">Total</dt>
          <dd className="font-semibold text-ink-heading">{money(total)}</dd>
        </div>
      </dl>

      {payment.status === "PENDING" && payment.paymentLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
          <span className="text-ink-tertiary">Send this link to the customer:</span>
          <a href={payment.paymentLink} target="_blank" rel="noreferrer" className="break-all text-ink-accent hover:underline">
            {payment.paymentLink}
          </a>
          {payment.linkExpiresAt ? (
            <span className="text-ink-tertiary">
              (expires {new Date(payment.linkExpiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {payment.status === "PENDING" ? (
          <Button type="button" size="sm" onClick={() => void handleMarkSuccess()} isLoading={markingSuccess}>
            Mark Success Manually
          </Button>
        ) : null}
        {payment.status === "SUCCESS" && !showRefundForm ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowRefundForm(true)}>
            Initiate Refund
          </Button>
        ) : null}
        {payment.status === "SUCCESS" ? (
          <a
            href={`/api/payments/${payment.id}/invoice`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-white/[0.03]"
          >
            Download Invoice
          </a>
        ) : null}
      </div>

      {showRefundForm ? (
        <RefundCalculatorForm
          serviceType={serviceType}
          defaultPaidAmount={total}
          onSubmit={handleCreateRefund}
          onCancel={() => setShowRefundForm(false)}
          submitting={creatingRefund}
        />
      ) : null}

      {payment.refunds.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-hairline pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Refunds</p>
          {payment.refunds.map((refund) => (
            <div key={refund.id} className="flex flex-col gap-1.5 rounded-md bg-surface-2 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RefundStatusControl
                  refundId={refund.id}
                  status={refundStatuses[refund.id] ?? refund.status}
                  onChanged={(next) => setRefundStatuses((current) => ({ ...current, [refund.id]: next }))}
                />
                <span className="font-semibold text-ink-heading">{money(refund.refundAmount)}</span>
              </div>
              <p className="text-xs text-ink-tertiary">
                Paid {money(refund.paidAmount)} − Cancellation {money(refund.cancellationCharge)} − Gateway{" "}
                {money(refund.gatewayCharge)}
                {refund.reason ? ` · ${refund.reason}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
