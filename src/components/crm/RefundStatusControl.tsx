"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { RefundStatusBadge } from "./RefundStatusBadge";
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
  const nextStatuses = getAllowedNextRefundStatuses(status);

  const handleChange = async (nextStatus: string) => {
    if (!nextStatus || nextStatus === status) return;
    setPending(true);
    try {
      await patchJson(`/api/refunds/${refundId}/status`, { status: nextStatus });
      toast.success(`Refund status updated to ${REFUND_STATUS_LABELS[nextStatus as RefundStatus]}`);
      onChanged(nextStatus as RefundStatus);
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
            onChange={(event) => void handleChange(event.target.value)}
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
    </div>
  );
}
