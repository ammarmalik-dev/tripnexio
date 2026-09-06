import { cn } from "@/lib/cn";
import { DOCUMENT_STATUS_LABELS } from "@/lib/crm/labels";
import type { DocumentStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  REQUIRED: "bg-ink-primary/[0.06] text-ink-secondary",
  MISSING: "bg-warning/10 text-warning",
  RECEIVED: "bg-accent/10 text-accent-on-light",
  VERIFIED: "bg-success/10 text-success",
  REJECTED: "bg-error/10 text-error",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}
