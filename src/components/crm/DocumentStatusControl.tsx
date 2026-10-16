"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { DOCUMENT_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextDocumentStatuses } from "@/lib/documents/transitions";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { DocumentStatus } from "../../generated/prisma/enums";
import { useHasPermission } from "./StaffPermissions";

interface DocumentStatusControlProps {
  documentId: string;
  status: DocumentStatus;
  /** Shown under the badge while the document is REJECTED. */
  rejectionReason?: string | null;
  onChanged: (status: DocumentStatus, rejectionReason?: string | null) => void;
}

/** Offers only the allowed next statuses (src/lib/documents/transitions.ts); rejecting asks for a mandatory reason. */
export function DocumentStatusControl({ documentId, status, rejectionReason, onChanged }: DocumentStatusControlProps) {
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const nextStatuses = getAllowedNextDocumentStatuses(status);
  // Client doc 2026-10-15 (I9) — an Admin can move a validated / rejected document back for re-validation.
  const isAdmin = useHasPermission("admin.full");
  const [movingBack, setMovingBack] = useState(false);

  const moveBack = async (reason: string) => {
    setPending(true);
    try {
      await patchJson(`/api/documents/${documentId}/status`, { status: "RECEIVED", override: true, overrideReason: reason });
      toast.success("Document moved back to Received (validation pending).");
      onChanged("RECEIVED", null);
      setMovingBack(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't move the document back.");
    } finally {
      setPending(false);
    }
  };

  const submit = async (nextStatus: DocumentStatus, reason?: string) => {
    setPending(true);
    try {
      await patchJson(`/api/documents/${documentId}/status`, { status: nextStatus, ...(reason ? { rejectionReason: reason } : {}) });
      toast.success(`Document marked ${nextStatus === "MISSING" ? "missing — flagged for notification" : nextStatus.toLowerCase()}`);
      onChanged(nextStatus, nextStatus === "REJECTED" ? reason : null);
      setRejecting(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the document status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleChange = (value: string) => {
    if (!value) return;
    if (value === "REJECTED") {
      setRejecting(true);
      return;
    }
    void submit(value as DocumentStatus);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <DocumentStatusBadge status={status} />
        {nextStatuses.length > 0 ? (
          <>
            <label htmlFor={`doc-status-${documentId}`} className="sr-only">
              Change document status
            </label>
            <select
              id={`doc-status-${documentId}`}
              value=""
              disabled={pending}
              onChange={(event) => handleChange(event.target.value)}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[130px] text-xs")}
            >
              <option value="" disabled>
                Move to…
              </option>
              {nextStatuses.map((next) => (
                <option key={next} value={next}>
                  {DOCUMENT_STATUS_LABELS[next]}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {isAdmin && (status === "VERIFIED" || status === "REJECTED") ? (
          <button type="button" onClick={() => setMovingBack(true)} disabled={pending} className="text-xs font-medium text-warning hover:underline">
            Move back
          </button>
        ) : null}
      </div>
      {status === "REJECTED" && rejectionReason ? <p className="text-xs text-error">Reason: {rejectionReason}</p> : null}
      {rejecting ? (
        <ConfirmActionDialog
          title="Reject this document?"
          description="The customer is notified and sees this reason, so write it for them (e.g. which part is unclear)."
          confirmLabel="Reject Document"
          pending={pending}
          onConfirm={(reason) => void submit("REJECTED", reason)}
          onCancel={() => setRejecting(false)}
        />
      ) : null}
      {movingBack ? (
        <ConfirmActionDialog
          title="Move this document back to Received?"
          description="Admin override: the document goes back to validation pending so it can be checked again. Your reason is saved in the audit log."
          confirmLabel="Move Back"
          pending={pending}
          onConfirm={(reason) => void moveBack(reason)}
          onCancel={() => setMovingBack(false)}
        />
      ) : null}
    </div>
  );
}
