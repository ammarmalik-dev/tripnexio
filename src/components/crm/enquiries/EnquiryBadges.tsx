import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { ENQUIRY_CATEGORY_LABELS, ENQUIRY_STATUS_LABELS } from "@/lib/enquiries/labels";
import type { EnquiryCategory, EnquiryStatus } from "../../../generated/prisma/enums";

const STATUS_STYLES: Record<EnquiryStatus, string> = {
  NEW: "bg-accent/10 text-accent-on-light",
  IN_PROGRESS: "bg-warning/10 text-warning",
  RESOLVED: "bg-success/10 text-success",
  CLOSED: "bg-ink-primary/[0.06] text-ink-secondary",
  CONVERTED: "bg-success/10 text-success",
};

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return <span className={cn(pill, STATUS_STYLES[status])}>{ENQUIRY_STATUS_LABELS[status]}</span>;
}

export function EnquiryCategoryBadge({ category }: { category: EnquiryCategory }) {
  if (category === "COMPLAINT") {
    return (
      <span className={cn(pill, "bg-error/10 text-error")}>
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Complaint
      </span>
    );
  }
  return <span className={cn(pill, "bg-ink-primary/[0.06] text-ink-secondary")}>{ENQUIRY_CATEGORY_LABELS[category]}</span>;
}
