"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { DateField } from "@/components/forms/DateField";
import { Button } from "@/components/ui/Button";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

type EligibilityOutcome = "ELIGIBLE" | "URGENT_TODAY" | "NOT_ELIGIBLE";

const OUTCOME_COPY: Record<EligibilityOutcome, { label: string; description: string; tone: string; icon: typeof CheckCircle2 }> = {
  ELIGIBLE: {
    label: "Eligible for 30-day Extension",
    description: "Not yet expired, or expired less than 30 days ago — may proceed to quotation.",
    tone: "bg-success/10 text-success border-success/30",
    icon: CheckCircle2,
  },
  URGENT_TODAY: {
    label: "Urgent — visa expires today",
    description:
      "Mark this case urgent. Payment must be completed by 6:00 PM on the same working day. TripNexio is not responsible for fines from late payment.",
    tone: "bg-warning/10 text-warning border-warning/30",
    icon: AlertTriangle,
  },
  NOT_ELIGIBLE: {
    label: "Not eligible for 30-day Extension",
    description:
      "Expired 30 days or more — not eligible for the 30-day Extension, even if the customer is willing to pay any applicable overstay fine.",
    tone: "bg-error/10 text-error border-error/30",
    icon: XCircle,
  },
};

interface VisaExtensionEligibilityPanelProps {
  leadId: string;
  verifiedExpiryDate?: string;
  eligibilityOutcome?: EligibilityOutcome;
  onVerified: (result: { verifiedExpiryDate: string; outcome: EligibilityOutcome }) => void;
}

/**
 * Visa_Extension.md §8/§9: staff manually verifies the actual visa expiry
 * date before eligibility/quotation can proceed — the customer never
 * enters or sees an unverified expiry (§5/§10). This is the only place the
 * ≥30-day-expired and same-day-6PM rules are enforced, matching where the
 * spec says they actually apply.
 */
export function VisaExtensionEligibilityPanel({
  leadId,
  verifiedExpiryDate,
  eligibilityOutcome,
  onVerified,
}: VisaExtensionEligibilityPanelProps) {
  const [date, setDate] = useState(verifiedExpiryDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleVerify = async () => {
    if (!date) return;
    setSaving(true);
    setError(undefined);
    try {
      const result = await patchJson<{ verifiedExpiryDate: string; outcome: EligibilityOutcome }>(
        `/api/leads/${leadId}/visa-extension-verify`,
        { verifiedExpiryDate: date }
      );
      toast.success("Verified expiry saved.");
      onVerified(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the verified expiry. Please try again.");
      toast.error(err instanceof ApiError ? err.message : "Couldn't save the verified expiry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const outcomeCopy = eligibilityOutcome ? OUTCOME_COPY[eligibilityOutcome] : null;
  const OutcomeIcon = outcomeCopy?.icon;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink-heading">Staff Visa Verification</h2>
      <p className="mb-4 text-xs text-ink-tertiary">
        Enter the actual visa expiry date after checking the customer&apos;s real visa record. The customer never
        sees this until you&apos;ve verified it.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-[220px]">
          <DateField label="Verified Expiry Date" name="verifiedExpiryDate" value={date} onChange={(e) => setDate(e.target.value)} error={error} />
        </div>
        <Button type="button" size="sm" onClick={() => void handleVerify()} isLoading={saving} disabled={!date}>
          Save &amp; Check Eligibility
        </Button>
      </div>

      {outcomeCopy && OutcomeIcon ? (
        <div className={cn("mt-4 flex items-start gap-3 rounded-lg border p-3", outcomeCopy.tone)}>
          <OutcomeIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{outcomeCopy.label}</p>
            <p className="text-xs opacity-90">{outcomeCopy.description}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
