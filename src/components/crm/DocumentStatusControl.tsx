"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { DOCUMENT_STATUS_OPTIONS } from "@/lib/crm/labels";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { DocumentStatus } from "../../generated/prisma/enums";

interface DocumentStatusControlProps {
  documentId: string;
  status: DocumentStatus;
  onChanged: (status: DocumentStatus) => void;
}

/** No transition map for DocumentStatus (none was specified) — staff can move a document to any status directly. */
export function DocumentStatusControl({ documentId, status, onChanged }: DocumentStatusControlProps) {
  const [pending, setPending] = useState(false);

  const handleChange = async (nextStatus: string) => {
    if (!nextStatus || nextStatus === status) return;
    setPending(true);
    try {
      await patchJson(`/api/documents/${documentId}/status`, { status: nextStatus });
      toast.success(`Document marked ${nextStatus === "MISSING" ? "missing — flagged for notification" : nextStatus.toLowerCase()}`);
      onChanged(nextStatus as DocumentStatus);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the document status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DocumentStatusBadge status={status} />
      <label htmlFor={`doc-status-${documentId}`} className="sr-only">
        Change document status
      </label>
      <select
        id={`doc-status-${documentId}`}
        value={status}
        disabled={pending}
        onChange={(event) => void handleChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[130px] text-xs")}
      >
        {DOCUMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
