"use client";

import { useState, type ChangeEvent } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { RefundStatusControl } from "./RefundStatusControl";
import { RefundCalculatorForm } from "./RefundCalculatorForm";
import { postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import type { CreateRefundValues } from "@/lib/validation/refund-schema";
import type { RefundRuleResult } from "@/lib/refunds/rules";
import type { PaymentStatus, PaymentMethod, RefundStatus } from "../../generated/prisma/enums";

const ALLOWED_SLIP_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_SLIP_BYTES = 8 * 1024 * 1024;

export interface RefundData {
  id: string;
  paidAmount: string;
  cancellationCharge: string;
  gatewayCharge: string;
  refundAmount: string;
  reason: string | null;
  status: RefundStatus;
  createdAt: string;
  /** CRM.md §21 (Step 14) — empty means the refund applied to the whole booking. */
  passengerIds: string[];
}

export interface PaymentData {
  id: string;
  amount: string;
  couponCode: string | null;
  couponDiscount: string | null;
  gstAmount: string;
  gatewayFee: string;
  status: PaymentStatus;
  gatewayRef: string | null;
  paymentLink: string | null;
  linkExpiresAt: string | null;
  createdAt: string;
  refunds: RefundData[];
  /** Step 15 (audit §7.4) — the applicable per-service refund rule; null when this payment isn't SUCCESS (a refund can't apply yet regardless). */
  refundRule: RefundRuleResult | null;
  /** Step 51 — GATEWAY for every payment before this step; BANK_TRANSFER for one raised via the Manual Lead flow. */
  method: PaymentMethod;
  bankSlipUrl: string | null;
}

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function PaymentPanel({
  payment,
  passengers,
  onChanged,
  canApproveRefunds,
  canApproveBankTransfer,
}: {
  payment: PaymentData;
  /** This booking's own passengers — passed through to the refund calculator's passenger-selection checkboxes (CRM.md §21, Step 14). */
  passengers: { id: string; fullName: string }[];
  onChanged: () => void;
  canApproveRefunds: boolean;
  /** Step 51 — gates the "Approve Bank Transfer" button (payments.approve); uploading the slip itself only needs payments.edit, checked server-side, not here. */
  canApproveBankTransfer: boolean;
}) {
  const [markingSuccess, setMarkingSuccess] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [creatingRefund, setCreatingRefund] = useState(false);
  const [refundStatuses, setRefundStatuses] = useState<Record<string, RefundStatus>>({});
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [approvingTransfer, setApprovingTransfer] = useState(false);
  const [slipError, setSlipError] = useState<string | null>(null);

  const couponDiscount = Number(payment.couponDiscount ?? 0);
  const total = Number(payment.amount) - couponDiscount + Number(payment.gstAmount) + Number(payment.gatewayFee);

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

  const handleSlipChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSlipError(null);

    if (!ALLOWED_SLIP_TYPES.includes(file.type)) {
      setSlipError("Please upload a JPEG, PNG, GIF, WebP, or PDF file.");
      return;
    }
    if (file.size > MAX_SLIP_BYTES) {
      setSlipError("That file is too large (8MB max).");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const fileBase64 = result.split(",")[1] ?? "";
      setUploadingSlip(true);
      try {
        await postJson(`/api/payments/${payment.id}/bank-slip`, { fileBase64, mimeType: file.type });
        toast.success("Slip uploaded.");
        onChanged();
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "Couldn't upload that file. Please try again.");
      } finally {
        setUploadingSlip(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApproveBankTransfer = async () => {
    setApprovingTransfer(true);
    try {
      await postJson(`/api/payments/${payment.id}/approve-bank-transfer`, {});
      toast.success("Bank transfer approved.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't approve this bank transfer. Please try again.");
    } finally {
      setApprovingTransfer(false);
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
        {payment.couponCode ? (
          <div className="flex flex-col">
            <dt className="text-xs text-ink-tertiary">Coupon ({payment.couponCode})</dt>
            <dd className="font-medium text-success">− {money(couponDiscount)}</dd>
          </div>
        ) : null}
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

      {payment.method === "BANK_TRANSFER" && payment.status === "PENDING" ? (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 px-3 py-2.5 text-xs">
          <span className="font-medium text-ink-secondary">Bank Transfer — awaiting slip and approval</span>
          {payment.bankSlipUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={payment.bankSlipUrl} target="_blank" rel="noreferrer" className="text-ink-accent hover:underline">
                View uploaded slip
              </a>
              {canApproveBankTransfer ? (
                <Button type="button" size="sm" onClick={() => void handleApproveBankTransfer()} isLoading={approvingTransfer}>
                  Approve Bank Transfer
                </Button>
              ) : (
                <span className="text-ink-tertiary">Only an approver can confirm this.</span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 font-medium text-ink-primary hover:bg-white/[0.03]">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {uploadingSlip ? "Uploading…" : "Upload Slip"}
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" disabled={uploadingSlip} onChange={(event) => void handleSlipChange(event)} />
              </label>
              {slipError ? <span className="text-error">{slipError}</span> : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {payment.status === "PENDING" ? (
          <Button type="button" size="sm" onClick={() => void handleMarkSuccess()} isLoading={markingSuccess}>
            Mark Success Manually
          </Button>
        ) : null}
        {payment.status === "SUCCESS" && payment.refundRule?.allowed && !showRefundForm ? (
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

      {payment.status === "SUCCESS" && payment.refundRule && !payment.refundRule.allowed ? (
        <div className="flex items-start gap-2 rounded-md border border-error/20 bg-error/[0.06] px-3 py-2.5 text-xs text-error">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{payment.refundRule.label}</span>
        </div>
      ) : null}

      {showRefundForm && payment.refundRule?.allowed ? (
        <RefundCalculatorForm
          defaultPaidAmount={total}
          refundRule={payment.refundRule}
          passengers={passengers}
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
                  canApprove={canApproveRefunds}
                />
                <span className="font-semibold text-ink-heading">{money(refund.refundAmount)}</span>
              </div>
              <p className="text-xs text-ink-tertiary">
                Paid {money(refund.paidAmount)} − Cancellation {money(refund.cancellationCharge)} − Gateway{" "}
                {money(refund.gatewayCharge)}
                {refund.reason ? ` · ${refund.reason}` : ""}
              </p>
              {refund.passengerIds.length > 0 ? (
                <p className="text-xs text-ink-tertiary">
                  Applies to:{" "}
                  {refund.passengerIds
                    .map((pid) => passengers.find((passenger) => passenger.id === pid)?.fullName ?? pid)
                    .join(", ")}
                </p>
              ) : (
                <p className="text-xs text-ink-tertiary">Applies to: whole booking</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
