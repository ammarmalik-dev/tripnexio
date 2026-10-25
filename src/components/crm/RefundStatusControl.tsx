"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { RefundStatusBadge } from "./RefundStatusBadge";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { REFUND_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextRefundStatuses } from "@/lib/refunds/transitions";
import { REFUND_APPROVAL_STATUSES } from "@/lib/refunds/approval-limit";
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
}

export function RefundStatusControl({ refundId, status, onChanged, canApprove, gatewayRefundId, gatewayRefundStatus, approvalLimitLabel }: RefundStatusControlProps) {
  const [checking, setChecking] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState(gatewayRefundStatus ?? null);
  const [pending, setPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RefundStatus | null>(null);
  const allNextStatuses = getAllowedNextRefundStatuses(status);
  const nextStatuses = approvalLimitLabel ? allNextStatuses.filter((next) => !REFUND_APPROVAL_STATUSES.includes(next)) : allNextStatuses;

  const handleConfirm = async (reason: string) => {
    if (!pendingStatus) return;
    setPending(true);
    try {
      await patchJson(`/api/refunds/${refundId}/status`, { status: pendingStatus, reason });
      toast.success(`Refund status updated to ${REFUND_STATUS_LABELS[pendingStatus]}`);
      onChanged(pendingStatus);
      setPendingStatus(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the refund status. Please try again.");
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
        toast.success(result.status === "COMPLETED" ? "The gateway has processed this refund." : "The gateway refund failed — approve it again or refund manually.");
      } else {
        toast.success(`Still ${result.gatewayRefundStatus} at the gateway.`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't check the refund with the gateway.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <RefundStatusBadge status={status} />
        {allNextStatuses.length === 0 ? (
          <span className="text-xs text-ink-tertiary">Final status</span>
        ) : !canApprove ? (
          <span className="text-xs text-ink-tertiary">Awaiting Admin approval</span>
        ) : (
          <>
            <label htmlFor={`refund-status-select-${refundId}`} className="sr-only">
              Change refund status
            </label>
            <select
              id={`refund-status-select-${refundId}`}
              value=""
              disabled={pending}
              onChange={(event) => setPendingStatus((event.target.value || null) as RefundStatus | null)}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[160px] text-sm")}
            >
              <option value="" disabled>
                Move to…
              </option>
              {nextStatuses.map((next) => (
                <option key={next} value={next}>
                  {REFUND_STATUS_LABELS[next]}
                </option>
              ))}
            </select>
          </>
        )}
        {canApprove && approvalLimitLabel && allNextStatuses.length > 0 ? (
          <span className="text-xs font-medium text-warning" title={`Your refund approval limit is ${approvalLimitLabel}. An admin must approve it.`}>
            Above your approval limit
          </span>
        ) : null}

        {pendingStatus ? (
          <ConfirmActionDialog
            title={`Move refund to ${REFUND_STATUS_LABELS[pendingStatus]}?`}
            description="Refund status changes are a sensitive financial action (Business Rules §14) — this is recorded in the audit trail with your reason."
            confirmLabel="Confirm Change"
            pending={pending}
            onConfirm={(reason) => void handleConfirm(reason)}
            onCancel={() => setPendingStatus(null)}
          />
        ) : null}
      </div>
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
