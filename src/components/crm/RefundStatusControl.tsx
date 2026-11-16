"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { RefundStatusBadge } from "./RefundStatusBadge";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { useHasPermission } from "./StaffPermissions";
import { patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { RefundStatus } from "../../generated/prisma/enums";

interface RefundStatusControlProps {
  refundId: string;
  status: RefundStatus;
  onChanged: (status: RefundStatus) => void;
  /**
   * CRM.md §21: "CRM raises, Admin approves/rejects — CRM cannot approve its
   * own refund." When false, the viewer can see the refund is awaiting
   * approval but the actual transition control is hidden — the server
   * enforces this too (PATCH /api/refunds/[id]/status requires
   * refunds.approve), this is just the matching UI state, not the real gate.
   */
  canApprove: boolean;
  /** Client doc 2026-10-15 (I5) — the gateway's refund id / status once Admin approval sent it there. */
  gatewayRefundId?: string | null;
  gatewayRefundStatus?: string | null;
  /**
   * Admin handover §17 — set (e.g. "₹10,000") when the refund is above the
   * viewer's refund approval limit: approving is hidden, rejecting stays. UI
   * only; PATCH /api/refunds/[id]/status enforces the limit.
   */
  approvalLimitLabel?: string | null;
  /** Client doc 16 Nov (H8) — the payment was a bank transfer: approving asks for the bank transaction details. */
  bankTransfer?: boolean;
  /** Client doc 16 Nov (H5) — the refund's amount, pre-filled when a rejected refund is corrected and sent again. */
  refundAmount?: number;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Client doc 16 Nov (H7 / H8 / H5) — the approver has only Approve and Reject. Approving an online refund sends it to
 * the gateway (it completes when the gateway confirms it — Check gateway); approving a bank-transfer refund needs the
 * transaction number and date and completes it. A rejected refund can be corrected and sent for approval again.
 */
export function RefundStatusControl({
  refundId,
  status,
  onChanged,
  canApprove,
  gatewayRefundId,
  gatewayRefundStatus,
  approvalLimitLabel,
  bankTransfer = false,
  refundAmount,
}: RefundStatusControlProps) {
  const [checking, setChecking] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState(gatewayRefundStatus ?? null);
  const [pending, setPending] = useState(false);
  const [action, setActionState] = useState<"approve" | "reject" | "resubmit" | null>(null);
  // The bank-transfer / corrected-amount form is filled first; the confirmation opens on Continue.
  const [formDone, setFormDone] = useState(false);
  const setAction = (next: "approve" | "reject" | "resubmit" | null) => {
    setActionState(next);
    setFormDone(false);
  };
  const [bankRef, setBankRef] = useState("");
  const [bankDate, setBankDate] = useState(todayIso);
  const [newAmount, setNewAmount] = useState(refundAmount != null ? String(refundAmount) : "");
  const canResubmit = useHasPermission("payments.edit");
  const control = cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm");

  const send = async (reason: string) => {
    if (!action) return;
    setPending(true);
    try {
      if (action === "resubmit") {
        await patchJson(`/api/refunds/${refundId}`, { refundAmount: Number(newAmount), reason });
        toast.success("Refund corrected and sent for approval again.");
        onChanged("PENDING");
      } else {
        const result = await patchJson<{ status: RefundStatus }>(`/api/refunds/${refundId}/status`, {
          status: action === "approve" ? "PROCESSING" : "REJECTED",
          reason,
          ...(action === "approve" && bankTransfer ? { bankTransactionRef: bankRef.trim(), bankTransactionDate: bankDate } : {}),
        });
        toast.success(
          action === "reject"
            ? "Refund rejected — the booking is back where it was."
            : result.status === "COMPLETED"
              ? "Refund approved and completed."
              : "Refund approved and sent to the payment gateway."
        );
        onChanged(result.status);
      }
      setAction(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the refund. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const checkGateway = async () => {
    setChecking(true);
    try {
      const result = await postJson<{ changed: boolean; status: RefundStatus; gatewayRefundStatus: string }>(`/api/refunds/${refundId}/gateway-sync`, {});
      setGatewayStatus(result.gatewayRefundStatus);
      if (result.changed) {
        onChanged(result.status);
        toast.success(result.status === "COMPLETED" ? "The gateway has processed this refund." : "The gateway refund failed — it can be corrected and sent again.");
      } else {
        toast.success(`Still ${result.gatewayRefundStatus} at the gateway.`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't check the refund with the gateway.");
    } finally {
      setChecking(false);
    }
  };

  const bankReady = !bankTransfer || (bankRef.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(bankDate));
  const amountReady = Number(newAmount) > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <RefundStatusBadge status={status} />
        {status === "PENDING" && !canApprove ? <span className="text-xs text-ink-tertiary">Awaiting approval</span> : null}
        {status === "PENDING" && canApprove ? (
          <>
            {approvalLimitLabel ? (
              <span className="text-xs font-medium text-warning" title={`Your refund approval limit is ${approvalLimitLabel}. An admin must approve it.`}>
                Above your approval limit
              </span>
            ) : (
              <Button type="button" size="sm" onClick={() => setAction("approve")} disabled={pending}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setAction("reject")} disabled={pending}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </>
        ) : null}
        {status === "REJECTED" && canResubmit ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAction("resubmit")} disabled={pending}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Correct &amp; send again
          </Button>
        ) : null}
      </div>

      {action === "approve" && bankTransfer ? (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-hairline p-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ink-secondary">
            Bank transaction number
            <input value={bankRef} onChange={(event) => setBankRef(event.target.value)} className={control} maxLength={80} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-secondary">
            Transaction date
            <input type="date" value={bankDate} onChange={(event) => setBankDate(event.target.value)} className={control} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" onClick={() => setFormDone(true)} disabled={!bankReady}>
              Continue
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {action === "resubmit" ? (
        <label className="flex max-w-xs flex-col gap-1 text-xs text-ink-secondary">
          Corrected refund amount (₹)
          <input inputMode="decimal" value={newAmount} onChange={(event) => setNewAmount(event.target.value.replace(/[^\d.]/g, ""))} className={control} />
          <span className="flex gap-2">
            <Button type="button" size="sm" onClick={() => setFormDone(true)} disabled={!amountReady}>
              Continue
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
          </span>
        </label>
      ) : null}

      {action && (action === "reject" || (action === "approve" && !bankTransfer) || formDone) ? (
        <ConfirmActionDialog
          title={action === "approve" ? "Approve this refund?" : action === "reject" ? "Reject this refund?" : "Send the corrected refund for approval?"}
          description={
            action === "approve"
              ? bankTransfer
                ? "The refund is recorded as paid back by bank transfer with the transaction details above, and the customer is told."
                : "The refund is sent to the payment gateway now; it completes when the gateway confirms it."
              : action === "reject"
                ? "The refund is not paid and the booking goes back to the status it had before the cancellation request."
                : "The refund goes back to Pending with the corrected amount, for an approver to approve or reject."
          }
          confirmLabel={action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Send again"}
          pending={pending}
          onConfirm={(reason) => void send(reason)}
          onCancel={() => setAction(null)}
        />
      ) : null}

      {gatewayRefundId ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
          <span>
            Gateway refund ID <span className="font-mono text-ink-secondary">{gatewayRefundId}</span>
            {gatewayStatus ? ` · ${gatewayStatus}` : ""}
          </span>
          {status === "PROCESSING" ? (
            <button type="button" onClick={() => void checkGateway()} disabled={checking} className="font-medium text-ink-accent hover:underline disabled:opacity-50">
              {checking ? "Checking…" : "Check gateway"}
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
