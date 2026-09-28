"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { RefundStatusBadge } from "./RefundStatusBadge";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { REFUND_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextRefundStatuses } from "@/lib/refunds/transitions";
import { patchJson, ApiError } from "@/lib/api/client";
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
}

export function RefundStatusControl({ refundId, status, onChanged, canApprove }: RefundStatusControlProps) {
  const [pending, setPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RefundStatus | null>(null);
  const nextStatuses = getAllowedNextRefundStatuses(status);

  const handleConfirm = async (reason: string) => {
    if (!pendingStatus) return;
    setPending(true);
    try {
      await patchJson(`/api/refunds/${refundId}/status`, { status: pendingStatus, note: reason });
      toast.success(`Refund status updated to ${REFUND_STATUS_LABELS[pendingStatus]}`);
      onChanged(pendingStatus);
      setPendingStatus(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the refund status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <RefundStatusBadge status={status} />
      {nextStatuses.length === 0 ? (
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
  );
}
