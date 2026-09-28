"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/forms/Textarea";

/**
 * Business Rules §14 "Sensitive Admin Actions" — required flow is
 * "Permission Check → Extra Confirmation → Execute → Audit Log". Permission
 * check and audit log already happen server-side on every route this backs;
 * this component is the "Extra Confirmation" step, shared across every
 * sensitive action listed there (refund, vendor change, pricing change,
 * delete, bulk reassignment, document requirements, GST/tax config,
 * workflow/status config, financial adjustments) instead of a bespoke
 * confirm step per screen. The typed reason is what actually gets recorded
 * in the audit note server-side — this dialog only collects it.
 */
export function ConfirmActionDialog({
  title,
  description,
  confirmLabel = "Confirm",
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (reason.trim().length < 5) {
      setError("Enter a reason (at least 5 characters) before confirming.");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
      <div className="glass-overlay w-full max-w-md rounded-xl p-5">
        <h2 id="confirm-action-title" className="text-sm font-semibold text-ink-heading">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">{description}</p>
        <div className="mt-4">
          <Textarea
            name="confirm-action-reason"
            label="Reason"
            placeholder="Why is this action being taken?"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            required
          />
          {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} isLoading={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
