"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { PROTECTION_PLAN_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextProtectionPlanStatuses } from "@/lib/protection-plan/transitions";
import { cn } from "@/lib/cn";
import type { ProtectionPlanStatus } from "../../generated/prisma/enums";

export interface ProtectionPlanData {
  id: string;
  passengerId: string;
  status: ProtectionPlanStatus;
  price: string;
  termsAcceptedAt: string | null;
  refundAmount: string | null;
}

const STATUS_STYLES: Record<ProtectionPlanStatus, string> = {
  NOT_OFFERED: "bg-ink-primary/[0.06] text-ink-tertiary",
  OFFERED: "bg-ink-primary/[0.06] text-ink-secondary",
  SELECTED_TERMS_PENDING: "bg-accent/10 text-accent-on-light",
  TERMS_ACCEPTED: "bg-accent/10 text-accent-on-light",
  PURCHASED: "bg-success/10 text-success",
  UNDER_ELIGIBILITY_REVIEW: "bg-warning/10 text-warning",
  ELIGIBLE: "bg-success/10 text-success",
  INELIGIBLE: "bg-error/10 text-error",
  CANCELLED: "bg-error/10 text-error",
  REFUND_UNDER_REVIEW: "bg-warning/10 text-warning",
  REFUND_APPROVED: "bg-accent/10 text-accent-on-light",
  REFUND_REJECTED: "bg-error/10 text-error",
  REFUND_PROCESSING: "bg-accent/10 text-accent-on-light",
  REFUND_COMPLETED: "bg-success/10 text-success",
};

function ProtectionPlanBadge({ status }: { status: ProtectionPlanStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLES[status])}>
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {PROTECTION_PLAN_STATUS_LABELS[status]}
    </span>
  );
}

function PurchaseAction({ plan, onChanged }: { plan: ProtectionPlanData; onChanged: (plan: ProtectionPlanData) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    getJson<{ termsText: string }>("/api/protection-plan-config")
      .then((config) => {
        if (!cancelled) setTermsText(config.termsText);
      })
      .catch(() => {
        // Non-critical — the checkbox below still works without the terms preview text loaded.
      });
    return () => {
      cancelled = true;
    };
  }, [expanded]);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const updated = await patchJson<ProtectionPlanData>(`/api/protection-plans/${plan.id}/purchase`, { termsAccepted: true });
      toast.success("Protection Plan purchased.");
      onChanged(updated);
      setExpanded(false);
      setAccepted(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't complete the purchase. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  if (!expanded) {
    return (
      <Button type="button" size="sm" onClick={() => setExpanded(true)}>
        Select Protection Plan
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-glass-border bg-surface-2 p-3">
      {termsText ? <p className="max-h-24 overflow-y-auto text-xs text-ink-tertiary">{termsText}</p> : null}
      <label className="flex items-start gap-2 text-xs text-ink-secondary">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
        Customer has read and accepted the Protection Plan terms (₹{plan.price}).
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(false)} disabled={purchasing}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void handlePurchase()} isLoading={purchasing} disabled={!accepted}>
          Confirm Purchase
        </Button>
      </div>
    </div>
  );
}

export function ProtectionPlanControl({ plan, onChanged }: { plan: ProtectionPlanData; onChanged: (plan: ProtectionPlanData) => void }) {
  const [pending, setPending] = useState(false);
  const nextStatuses = getAllowedNextProtectionPlanStatuses(plan.status).filter((s) => s !== "PURCHASED");

  const handleChange = async (nextStatus: string) => {
    if (!nextStatus) return;
    setPending(true);
    try {
      const updated = await patchJson<ProtectionPlanData>(`/api/protection-plans/${plan.id}/status`, { status: nextStatus });
      toast.success(`Protection Plan moved to ${PROTECTION_PLAN_STATUS_LABELS[nextStatus as ProtectionPlanStatus]}`);
      onChanged(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the Protection Plan. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const canPurchase = plan.status === "OFFERED" || plan.status === "SELECTED_TERMS_PENDING";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ProtectionPlanBadge status={plan.status} />
      <span className="text-xs text-ink-tertiary">₹{plan.price}</span>
      {canPurchase ? <PurchaseAction plan={plan} onChanged={onChanged} /> : null}
      {!canPurchase && nextStatuses.length > 0 ? (
        <select
          value=""
          disabled={pending}
          onChange={(e) => void handleChange(e.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[160px] text-xs")}
        >
          <option value="" disabled>
            Move to…
          </option>
          {nextStatuses.map((next) => (
            <option key={next} value={next}>
              {PROTECTION_PLAN_STATUS_LABELS[next]}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
