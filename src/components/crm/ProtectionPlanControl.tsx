"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { PROTECTION_PLAN_STATUS_LABELS } from "@/lib/crm/labels";
import { getStaffSelectableProtectionPlanStatuses, NOTE_REQUIRED_PROTECTION_PLAN_STATUSES } from "@/lib/protection-plan/transitions";
import { cn } from "@/lib/cn";
import type { ProtectionPlanStatus } from "../../generated/prisma/enums";

export interface ProtectionPlanData {
  id: string;
  passengerId: string;
  status: ProtectionPlanStatus;
  price: string;
  termsAcceptedAt: string | null;
  refundAmount: string | null;
  decisionNote: string | null;
  paymentId: string | null;
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

const noteClass = cn(fieldControlClass, fieldBorderClass(false), "min-h-[60px] text-xs");

/** Staff adds the plan on the customer's behalf: terms shown, acceptance required; on a paid booking this raises a separate payment. */
function PurchaseAction({ plan, onChanged }: { plan: ProtectionPlanData; onChanged: () => void }) {
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
      const updated = await patchJson<ProtectionPlanData & { paymentLink: string | null }>(`/api/protection-plans/${plan.id}/purchase`, { termsAccepted: true });
      toast.success(
        updated.paymentLink
          ? "Protection Plan added — a separate payment link was created on this booking."
          : "Protection Plan added — it will be included in the next payment link for this booking."
      );
      setExpanded(false);
      setAccepted(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add the Protection Plan. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  if (!expanded) {
    return (
      <Button type="button" size="sm" onClick={() => setExpanded(true)}>
        {plan.status === "TERMS_ACCEPTED" ? "Retry payment" : "Add Protection Plan"}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-glass-border bg-surface-2 p-3">
      {termsText ? <p className="max-h-32 overflow-y-auto whitespace-pre-line text-xs text-ink-tertiary">{termsText}</p> : null}
      <label className="flex items-start gap-2 text-xs text-ink-secondary">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
        Customer has read and accepted the Protection Plan terms (₹{plan.price}).
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(false)} disabled={purchasing}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void handlePurchase()} isLoading={purchasing} disabled={!accepted}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

/** Eligibility flag/decision, refund review or cancel — every one needs a staff note. */
function StatusAction({ plan, onChanged }: { plan: ProtectionPlanData; onChanged: () => void }) {
  const nextStatuses = getStaffSelectableProtectionPlanStatuses(plan.status);
  const [target, setTarget] = useState<ProtectionPlanStatus | "">("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  if (nextStatuses.length === 0) return null;
  const needsNote = target !== "" && NOTE_REQUIRED_PROTECTION_PLAN_STATUSES.includes(target);

  const submit = async () => {
    if (!target) return;
    setPending(true);
    try {
      await patchJson(`/api/protection-plans/${plan.id}/status`, { status: target, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success(`Protection Plan moved to ${PROTECTION_PLAN_STATUS_LABELS[target]}`);
      setTarget("");
      setNote("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the Protection Plan. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <select
        value={target}
        disabled={pending}
        onChange={(e) => setTarget(e.target.value as ProtectionPlanStatus | "")}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[180px] self-start text-xs")}
        aria-label="Change Protection Plan status"
      >
        <option value="">Move to…</option>
        {nextStatuses.map((next) => (
          <option key={next} value={next}>
            {next === "UNDER_ELIGIBILITY_REVIEW" ? "Flag for eligibility review" : PROTECTION_PLAN_STATUS_LABELS[next]}
          </option>
        ))}
      </select>
      {target ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={needsNote ? "Note (required)" : "Note (optional)"}
            aria-label="Decision note"
            className={noteClass}
            disabled={pending}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setTarget("")} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void submit()} isLoading={pending} disabled={needsNote && !note.trim()}>
              Save
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Manager/admin (refunds.approve): approve raises a Refund for the plan amount that another approver then processes. */
function RefundDecision({ plan, onChanged }: { plan: ProtectionPlanData; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"APPROVE" | "REJECT" | null>(null);

  const decide = async (decision: "APPROVE" | "REJECT") => {
    setPending(decision);
    try {
      await patchJson(`/api/protection-plans/${plan.id}/refund-decision`, { decision, note: note.trim() });
      toast.success(decision === "APPROVE" ? `Refund of ₹${plan.price} raised — another approver must process it.` : "Protection Plan refund rejected.");
      setNote("");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't record the decision. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 p-3">
      <p className="text-xs font-medium text-ink-secondary">Protection Plan refund review — ₹{plan.price}</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (required)" aria-label="Refund decision note" className={noteClass} />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => void decide("REJECT")} isLoading={pending === "REJECT"} disabled={pending !== null || note.trim().length < 3}>
          Reject
        </Button>
        <Button type="button" size="sm" onClick={() => void decide("APPROVE")} isLoading={pending === "APPROVE"} disabled={pending !== null || note.trim().length < 3}>
          Approve refund
        </Button>
      </div>
    </div>
  );
}

export function ProtectionPlanControl({
  plan,
  canDecideRefund,
  onChanged,
}: {
  plan: ProtectionPlanData;
  canDecideRefund: boolean;
  onChanged: () => void;
}) {
  const canPurchase = plan.status === "OFFERED" || plan.status === "SELECTED_TERMS_PENDING" || (plan.status === "TERMS_ACCEPTED" && !plan.paymentId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ProtectionPlanBadge status={plan.status} />
        <span className="text-xs text-ink-tertiary">₹{plan.price}</span>
        {plan.status === "TERMS_ACCEPTED" && plan.paymentId ? <span className="text-xs text-ink-tertiary">Awaiting payment</span> : null}
      </div>
      {plan.decisionNote ? <p className="text-xs text-ink-tertiary">Note: {plan.decisionNote}</p> : null}
      {canPurchase ? <PurchaseAction plan={plan} onChanged={onChanged} /> : null}
      {plan.status === "REFUND_UNDER_REVIEW" && canDecideRefund ? <RefundDecision plan={plan} onChanged={onChanged} /> : null}
      {!canPurchase && plan.status !== "REFUND_UNDER_REVIEW" ? <StatusAction plan={plan} onChanged={onChanged} /> : null}
    </div>
  );
}
